import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { classifyEntry, detectIntent, processTask } from "@/lib/openai";
import { createBlinkitClient, callTool, CartItem } from "@/lib/blinkit";
import { lookupSKU, parseQuantity } from "@/lib/skuMap";
import { listEvents, createEvent } from "@/lib/googleCalendar";
import { searchContacts, getLastMessage, listRecentMessages } from "@/lib/whatsapp";

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

    // Classify first: thought (capture-only) vs task (run intent router)
    const classification = await step.run("classify-entry", async () => {
      const result = await classifyEntry(input);
      console.log(`[classify] "${input}" →`, JSON.stringify(result));
      const { error } = await supabase
        .from("tasks")
        .update({
          entry_type: result.entry_type,
          tags: result.tags,
          classification_confidence: result.confidence,
        })
        .eq("id", id);
      if (error) throw error;
      return result;
    });

    if (classification.entry_type === "thought") {
      await step.run("mark-captured", async () => {
        const { error } = await supabase
          .from("tasks")
          .update({ status: "captured" })
          .eq("id", id);
        if (error) throw error;
      });
      return { success: true, captured: true };
    }

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", id);
      if (error) throw error;
    });

    // Detect intent for all three types
    const intent = await step.run("detect-intent", async () => {
      const result = await detectIntent(input);
      console.log(`[intent] "${input}" →`, JSON.stringify(result));
      return result;
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

    // --- WhatsApp read path ---
    if (intent.type === "whatsapp_read") {
      try {
        await step.run("set-task-type-whatsapp-read", async () => {
          const { error } = await supabase
            .from("tasks")
            .update({ task_type: "whatsapp" })
            .eq("id", id);
          if (error) throw error;
        });

        const summary = await step.run("whatsapp-read-messages", async () => {
          const contacts = searchContacts(intent.recipient_query);
          if (contacts.length === 0) {
            return `No contact found matching "${intent.recipient_query}"`;
          }
          const contact = contacts[0];
          const messages = listRecentMessages(contact.jid, 5);
          if (messages.length === 0) {
            return `No messages found with ${contact.name}`;
          }
          const lines = messages.reverse().map((m) => {
            const time = new Date(m.timestamp * 1000).toLocaleString("en-IN", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              timeZone: "Asia/Kolkata",
            });
            const who = m.is_from_me ? "You" : contact.name;
            return `[${time}] ${who}: ${m.content ?? "(media)"}`;
          });
          return `Last ${messages.length} messages with ${contact.name}:\n${lines.join("\n")}`;
        });

        await step.run("update-status-done-whatsapp-read", async () => {
          const { error } = await supabase
            .from("tasks")
            .update({ status: "done", result_summary: summary })
            .eq("id", id);
          if (error) throw error;
        });

        return { success: true };
      } catch (error: unknown) {
        await step.run("update-status-failed-whatsapp-read", async () => {
          const message = error instanceof Error ? error.message : "Unknown error";
          await supabase
            .from("tasks")
            .update({ status: "failed", error_reason: message })
            .eq("id", id);
        });
        throw error;
      }
    }

    // --- WhatsApp send path ---
    if (intent.type === "whatsapp_send") {
      try {
        await step.run("set-task-type-whatsapp-send", async () => {
          const { error } = await supabase
            .from("tasks")
            .update({ task_type: "whatsapp" })
            .eq("id", id);
          if (error) throw error;
        });

        const proposedMessage = await step.run("whatsapp-resolve-recipient", async () => {
          console.log(`[whatsapp-send] recipient_query="${intent.recipient_query}" body="${intent.message_body}"`);
          const contacts = searchContacts(intent.recipient_query);
          console.log(`[whatsapp-send] contacts found: ${contacts.length}`, contacts);
          if (contacts.length === 0) {
            throw new Error(`No contact found matching "${intent.recipient_query}"`);
          }
          const contact = contacts[0];
          return {
            recipient: contact.jid,
            recipient_name: contact.name,
            body: intent.message_body,
          };
        });

        await step.run("update-needs-approval-whatsapp", async () => {
          const { error } = await supabase
            .from("tasks")
            .update({
              status: "needs_approval",
              requires_approval: true,
              proposed_message: proposedMessage,
              result_summary: `Send to ${proposedMessage.recipient_name}: "${proposedMessage.body}"`,
            })
            .eq("id", id);
          if (error) throw error;
        });

        return { success: true };
      } catch (error: unknown) {
        await step.run("update-status-failed-whatsapp-send", async () => {
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
                url: sku.url,
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

            const productId = idMatch?.[1] ?? "";
            const productName = nameMatch?.[1]?.trim() ?? item.name;
            const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            cart.push({
              requested: item.name,
              name: productName,
              product_id: productId,
              quantity: item.quantity,
              unit_price: priceMatch?.[0] ?? "",
              url: productId ? `https://blinkit.com/prn/${slug}/prid/${productId}` : undefined,
              not_found: !productId,
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
