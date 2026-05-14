import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { executeTask } from "@/inngest/executeTask";
import { placeBlinkitOrder } from "@/inngest/placeBlinkitOrder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    executeTask,
    placeBlinkitOrder,
  ],
});
