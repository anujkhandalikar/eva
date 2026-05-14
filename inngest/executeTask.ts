import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { detectIntent, processTask } from "@/lib/openai";
import { createBlinkitClient, callTool, CartItem } from "@/lib/blinkit";
import { lookupSKU, parseQuantity } from "@/lib/skuMap";
import { listEvents, createEvent } from "@/lib/googleCalendar";

function formatEventList(events: Awaited<ReturnType<typeof listEvents>>): string {
  if (events.length === 0) return "No events found in that time range.";
  return events
    .map((e) => {
      const start = new Date(e.start).toLocaleString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      return `- ${e.summary} — ${start}${e.location ? ` @ ${e.location}` : ""}`;
    })
    .join("\n");
}

export const executeTask = inngest.createFunction(
  {
    id: "execute-task",
    triggers: [{ event: "task/created" }],
    retries: 3,
    concurrency: { limit: 3 },
  },
  async ({ event, step }) => {
    const { id, input } = event.data;

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", id);
      if (error) throw error;
    });

    // Detect intent for all three types
    const intent = await step.run("detect-intent", async () => {
      return await detectIntent(input);
    });

    // --- Calendar path ---
    if (intent.type === "calendar") {
      const { action } = intent;

      try {
        if (action.type === "list") {
          // Read-only — execute immediately
          await step.run("set-task-type-calendar", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ task_type: "calendar", calendar_action: action })
              .eq("id", id);
            if (error) throw error;
          });

          const events = await step.run("list-calendar-events", async () => {
            return await listEvents({
              timeMin: action.timeMin,
              timeMax: action.timeMax,
              query: action.query,
            });
          });

          await step.run("update-status-done-calendar", async () => {
            const summary = formatEventList(events);
            const { error } = await supabase
              .from("tasks")
              .update({ status: "done", result_summary: summary })
              .eq("id", id);
            if (error) throw error;
          });
        } else if (action.type === "create") {
          // Create — execute immediately, no approval
          await step.run("set-task-type-calendar", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ task_type: "calendar", calendar_action: action })
              .eq("id", id);
            if (error) throw error;
          });

          const created = await step.run("create-calendar-event", async () => {
            return await createEvent({
              summary: action.summary,
              startTime: action.startTime,
              endTime: action.endTime,
              description: action.description,
              location: action.location,
              attendees: action.attendees,
            });
          });

          await step.run("update-status-done-created", async () => {
            const start = new Date(created.start).toLocaleString("en-IN", {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
            });
            const { error } = await supabase
              .from("tasks")
              .update({
                status: "done",
                result_summary: `Created: "${created.summary}" on ${start}`,
                calendar_event_id: created.id,
              })
              .eq("id", id);
            if (error) throw error;
          });
        } else {
          // update/delete — needs approval. Single update with all fields so
          // real-time payload always includes calendar_action.
          const proposedSummary = action.type === "update"
            ? `Update event: "${action.eventSummary}"`
            : `Delete event: "${action.eventSummary}"`;

          await step.run("update-needs-approval-calendar", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({
                task_type: "calendar",
                calendar_action: action,
                status: "needs_approval",
                requires_approval: true,
                result_summary: proposedSummary,
              })
              .eq("id", id);
            if (error) throw error;
          });
        }

        return { success: true };
      } catch (error: unknown) {
        await step.run("update-status-failed-calendar", async () => {
          const message = error instanceof Error ? error.message : "Unknown error";
          await supabase
            .from("tasks")
            .update({ status: "failed", error_reason: message })
            .eq("id", id);
        });
        throw error;
      }
    }

    // --- Research path ---
    if (intent.type === "research") {
      try {
        const result = await step.run("process-with-openai", async () => {
          return await processTask(input);
        });

        await step.run("update-status-success", async () => {
          const status = result.requires_approval ? "needs_approval" : "done";
          const { error } = await supabase
            .from("tasks")
            .update({
              status,
              result_summary: result.summary,
              result_full: result.full_result,
              requires_approval: result.requires_approval,
            })
            .eq("id", id);
          if (error) throw error;
        });

        return { success: true };
      } catch (error: unknown) {
        await step.run("update-status-failed", async () => {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          await supabase
            .from("tasks")
            .update({ status: "failed", error_reason: message })
            .eq("id", id);
        });
        throw error;
      }
    }

    // --- Blinkit order path ---
    await step.run("set-task-type", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ task_type: "blinkit_order" })
        .eq("id", id);
      if (error) throw error;
    });

    try {
      // Parse items from input using gpt-4o-mini
      const parsedItems = await step.run("parse-items", async () => {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Extract items and quantities from a grocery order request.
Respond with ONLY valid JSON: {"items": [{"name": "item name", "quantity": 1}]}
Use the exact item name the user said. Default quantity to 1 if not specified.`,
            },
            { role: "user", content: input },
          ],
        });
        const text = res.choices[0]?.message?.content ?? '{"items":[]}';
        try {
          const parsed = JSON.parse(text) as { items: { name: string; quantity: number }[] };
          return parsed.items;
        } catch {
          return [{ name: input, quantity: parseQuantity(input) }];
        }
      });

      const unknownItems = parsedItems.filter((item) => !lookupSKU(item.name));
      const needsMCP = unknownItems.length > 0;

      if (needsMCP) {
        const loginStatus = await step.run("blinkit-check-login", async () => {
          const mcp = await createBlinkitClient();
          try {
            return await callTool(mcp, "check_login");
          } finally {
            await mcp.close();
          }
        });

        if (loginStatus.includes("Not Logged In")) {
          await step.run("blinkit-send-otp", async () => {
            const phone = process.env.BLINKIT_PHONE;
            if (!phone) throw new Error("BLINKIT_PHONE env var not set");
            const mcp = await createBlinkitClient();
            try {
              await callTool(mcp, "login", { phone_number: phone });
            } finally {
              await mcp.close();
            }
          });

          await step.run("update-status-needs-otp", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ status: "needs_otp" })
              .eq("id", id);
            if (error) throw error;
          });

          const otpEvent = await step.waitForEvent("wait-for-otp", {
            event: "blinkit/otp.submitted",
            timeout: "5m",
            match: "data.taskId",
          });

          if (!otpEvent) {
            throw new Error("OTP not entered in time (5 min timeout).");
          }

          await step.run("blinkit-enter-otp", async () => {
            const mcp = await createBlinkitClient();
            try {
              await callTool(mcp, "enter_otp", { otp: otpEvent.data.otp });
            } finally {
              await mcp.close();
            }
          });

          await step.run("update-status-running-after-otp", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ status: "running" })
              .eq("id", id);
            if (error) throw error;
          });
        }
      }

      const proposedCart = await step.run("build-cart", async () => {
        const cart: CartItem[] = [];
        const mcp = needsMCP ? await createBlinkitClient() : null;

        try {
          for (const item of parsedItems) {
            const sku = lookupSKU(item.name);

            if (sku) {
              cart.push({
                requested: item.name,
                name: sku.name,
                product_id: sku.id,
                quantity: item.quantity,
                unit_price: "",
              });
              continue;
            }

            if (!mcp) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const searchResult = await callTool(mcp, "search", { query: item.name });
            if (!searchResult || searchResult.includes("No results found")) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const lines = searchResult
              .split("\n")
              .filter((l) => l.match(/^\[(\d+)\]/));

            if (lines.length === 0) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const { default: OpenAI } = await import("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const top5 = lines.slice(0, 5).join("\n");
            const pick = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "user",
                  content: `I want: "${item.name}"\n\nResults:\n${top5}\n\nReply with ONLY the index number of the best match.`,
                },
              ],
            });
            const index = parseInt(
              pick.choices[0]?.message?.content?.trim() ?? "0",
              10
            ) || 0;
            const chosen = lines[index] ?? lines[0];

            const idMatch = chosen.match(/ID:\s*([^\s|]+)/);
            const priceMatch = chosen.match(/₹[\d,]+/);
            const nameMatch = chosen.match(/\|\s*(.+?)\s*-\s*₹/);

            cart.push({
              requested: item.name,
              name: nameMatch?.[1]?.trim() ?? item.name,
              product_id: idMatch?.[1] ?? "",
              quantity: item.quantity,
              unit_price: priceMatch?.[0] ?? "",
              not_found: !idMatch?.[1],
            });
          }
        } finally {
          if (mcp) await mcp.close();
        }

        return cart;
      });

      await step.run("update-needs-approval", async () => {
        const foundItems = proposedCart.filter((i) => !i.not_found);
        const summary =
          proposedCart
            .map((i) =>
              i.not_found
                ? `- ${i.requested} (not found)`
                : `- ${i.name} ×${i.quantity}${i.unit_price ? ` — ${i.unit_price}` : ""}`
            )
            .join("\n");

        const { error } = await supabase
          .from("tasks")
          .update({
            status: foundItems.length > 0 ? "needs_approval" : "failed",
            error_reason: foundItems.length === 0 ? "None of the requested items were found on Blinkit." : null,
            requires_approval: foundItems.length > 0,
            proposed_cart: proposedCart,
            result_summary: summary,
          })
          .eq("id", id);
        if (error) throw error;
      });

      return { success: true };
    } catch (error: unknown) {
      await step.run("update-status-failed-blinkit", async () => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        await supabase
          .from("tasks")
          .update({ status: "failed", error_reason: message })
          .eq("id", id);
      });
      throw error;
    }
  }
);
