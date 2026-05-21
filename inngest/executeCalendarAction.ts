import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { createEvent, updateEvent, deleteEvent, listEvents } from "@/lib/googleCalendar";
import type { CalendarAction } from "@/lib/openai";

export const executeCalendarAction = inngest.createFunction(
  {
    id: "execute-calendar-action",
    triggers: [{ event: "calendar/action.approved" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { taskId } = event.data as { taskId: string };

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", taskId);
      if (error) throw error;
    });

    try {
      const calendarAction = await step.run("fetch-calendar-action", async () => {
        const { data, error } = await supabase
          .from("tasks")
          .select("calendar_action")
          .eq("id", taskId)
          .single();
        if (error) throw error;
        if (!data.calendar_action) throw new Error("No calendar_action found on task");
        return data.calendar_action as CalendarAction;
      });

      const result = await step.run("execute-calendar-action", async () => {
        if (calendarAction.type === "create") {
          const event = await createEvent({
            summary: calendarAction.summary,
            startTime: calendarAction.startTime,
            endTime: calendarAction.endTime,
            description: calendarAction.description,
            location: calendarAction.location,
            attendees: calendarAction.attendees,
          });
          const start = new Date(event.start).toLocaleString("en-IN", {
            weekday: "short", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
          });
          return {
            eventId: event.id,
            summary: `Created: "${event.summary}" on ${start}`,
          };
        }

        if (calendarAction.type === "update") {
          // If no eventId, find the event by name first
          let eventId = calendarAction.eventId;
          if (!eventId) {
            const now = new Date();
            const oneMonthOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const events = await listEvents({
              timeMin: now.toISOString(),
              timeMax: oneMonthOut.toISOString(),
              query: calendarAction.eventSummary,
            });
            if (events.length === 0) {
              throw new Error(`Event not found: "${calendarAction.eventSummary}"`);
            }
            eventId = events[0].id;
          }

          const updated = await updateEvent(eventId, {
            summary: calendarAction.summary,
            startTime: calendarAction.startTime,
            endTime: calendarAction.endTime,
            description: calendarAction.description,
          });
          return {
            eventId: updated.id,
            summary: `Updated: "${updated.summary}"`,
          };
        }

        if (calendarAction.type === "delete") {
          // If no eventId, find the event by name first
          let eventId = calendarAction.eventId;
          if (!eventId) {
            const now = new Date();
            const oneMonthOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const events = await listEvents({
              timeMin: now.toISOString(),
              timeMax: oneMonthOut.toISOString(),
              query: calendarAction.eventSummary,
            });
            if (events.length === 0) {
              throw new Error(`Event not found: "${calendarAction.eventSummary}"`);
            }
            eventId = events[0].id;
          }

          await deleteEvent(eventId);
          return {
            eventId: null,
            summary: `Deleted: "${calendarAction.eventSummary}"`,
          };
        }

        if (calendarAction.type === "delete_range") {
          const events = await listEvents({
            timeMin: calendarAction.timeMin,
            timeMax: calendarAction.timeMax,
            query: calendarAction.query,
          });
          if (events.length === 0) {
            return { eventId: null, summary: "No events to delete in that range." };
          }
          const failures: string[] = [];
          for (const e of events) {
            try {
              await deleteEvent(e.id);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "unknown";
              failures.push(`"${e.summary}" (${msg})`);
            }
          }
          const deleted = events.length - failures.length;
          const base = `Deleted ${deleted} of ${events.length} event${events.length === 1 ? "" : "s"}`;
          if (failures.length > 0) {
            return { eventId: null, summary: `${base}. Failed: ${failures.join(", ")}` };
          }
          return { eventId: null, summary: base };
        }

        throw new Error(`Unexpected calendar action type: ${(calendarAction as CalendarAction).type}`);
      });

      await step.run("update-status-done", async () => {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: "done",
            result_summary: result.summary,
            calendar_event_id: result.eventId,
          })
          .eq("id", taskId);
        if (error) throw error;
      });

      return { success: true };
    } catch (error: unknown) {
      await step.run("update-status-failed", async () => {
        const message = error instanceof Error ? error.message : "Unknown error";
        await supabase
          .from("tasks")
          .update({ status: "failed", error_reason: message })
          .eq("id", taskId);
      });
      throw error;
    }
  }
);
