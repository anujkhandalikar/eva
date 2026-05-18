import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeTask } from "@/inngest/executeTask";
import { placeBlinkitOrder } from "@/inngest/placeBlinkitOrder";
import { executeCalendarAction } from "@/inngest/executeCalendarAction";
import { captionImageThought } from "@/inngest/captionImageThought";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeTask,
    placeBlinkitOrder,
    executeCalendarAction,
    captionImageThought,
  ],
});
