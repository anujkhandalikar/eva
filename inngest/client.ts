import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "eva" });

// Event payload types — used for type safety when calling inngest.send()
export type TaskCreatedEvent = { id: string; input: string };
export type BlinkitOtpSubmittedEvent = { taskId: string; otp: string };
export type BlinkitOrderApprovedEvent = { taskId: string };
