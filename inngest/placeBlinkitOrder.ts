import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { executeOrder, CartItem } from "@/lib/blinkit";

export const placeBlinkitOrder = inngest.createFunction(
  {
    id: "place-blinkit-order",
    triggers: [{ event: "blinkit/order.approved" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { taskId } = event.data;

    const cart = await step.run("read-cart", async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("proposed_cart")
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return (data.proposed_cart ?? []) as CartItem[];
    });

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", taskId);
      if (error) throw error;
    });

    try {
      const result = await step.run("execute-order", async () => {
        return await executeOrder(cart);
      });

      await step.run("update-status-done", async () => {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            approved: true,
            result_summary: result.summary,
          })
          .eq("id", taskId);
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
          .eq("id", taskId);
      });
      throw error;
    }
  }
);
