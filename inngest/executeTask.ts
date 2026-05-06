import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { processTask } from "@/lib/gemini";

export const executeTask = inngest.createFunction(
  { id: "execute-task", triggers: [{ event: "task/created" }], retries: 0 },
  async ({ event, step }) => {
    const { id, input } = event.data;

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", id);
      if (error) throw error;
    });

    try {
      const result = await step.run("process-with-gemini", async () => {
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

      return { success: true, result };
    } catch (error: any) {
      await step.run("update-status-failed", async () => {
        const { error: updateError } = await supabase
          .from("tasks")
          .update({
            status: "failed",
            error_reason: error.message || "Unknown error occurred",
          })
          .eq("id", id);
        if (updateError) console.error("Failed to update task to failed status:", updateError);
      });
      throw error; // Re-throw to let Inngest know the step failed
    }
  }
);
