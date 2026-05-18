import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { captionImage } from "@/lib/openai";

export const captionImageThought = inngest.createFunction(
  {
    id: "caption-image-thought",
    triggers: [{ event: "thought/image-uploaded" }],
    retries: 2,
    concurrency: { limit: 4 },
  },
  async ({ event, step }) => {
    const { id, image_url } = event.data as { id: string; image_url: string };

    const caption = await step.run("caption", () => captionImage(image_url));

    await step.run("save", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ input: caption, status: "done" })
        .eq("id", id)
        // Only overwrite if input is still blank — guard against a user-typed
        // caption arriving after the job started.
        .eq("input", "");
      if (error) throw error;
    });

    return { id, caption };
  },
);
