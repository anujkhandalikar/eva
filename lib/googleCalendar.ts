import { google } from "googleapis";

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
};

export type CreateEventParams = {
  summary: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees?: string[];
};

export type UpdateEventParams = {
  summary?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  location?: string;
};

export type ListEventsParams = {
  timeMin: string;
  timeMax: string;
  query?: string;
  maxResults?: number;
};

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: "v3", auth });
}

export async function listEvents(params: ListEventsParams): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient();

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    q: params.query,
    maxResults: params.maxResults ?? 20,
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = res.data.items ?? [];

  return items.map((item) => ({
    id: item.id ?? "",
    summary: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    attendees: item.attendees?.map((a) => a.email ?? "").filter(Boolean),
  }));
}

export async function createEvent(params: CreateEventParams): Promise<CalendarEvent> {
  const calendar = getCalendarClient();

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: { dateTime: params.startTime },
      end: { dateTime: params.endTime },
      attendees: params.attendees?.map((email) => ({ email })),
    },
  });

  const item = res.data;
  return {
    id: item.id ?? "",
    summary: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    attendees: item.attendees?.map((a) => a.email ?? "").filter(Boolean),
  };
}

export async function updateEvent(
  eventId: string,
  params: UpdateEventParams
): Promise<CalendarEvent> {
  const calendar = getCalendarClient();

  const existing = await calendar.events.get({
    calendarId: "primary",
    eventId,
  });

  const res = await calendar.events.update({
    calendarId: "primary",
    eventId,
    requestBody: {
      ...existing.data,
      summary: params.summary ?? existing.data.summary,
      description: params.description ?? existing.data.description,
      location: params.location ?? existing.data.location,
      start: params.startTime
        ? { dateTime: params.startTime }
        : existing.data.start,
      end: params.endTime
        ? { dateTime: params.endTime }
        : existing.data.end,
    },
  });

  const item = res.data;
  return {
    id: item.id ?? "",
    summary: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    description: item.description ?? undefined,
    location: item.location ?? undefined,
    attendees: item.attendees?.map((a) => a.email ?? "").filter(Boolean),
  };
}

export async function deleteEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}

// --- Google Tasks (faked as all-day events in a dedicated calendar) ---
//
// User creates a separate calendar in GCal (e.g. "Eva Tasks") and sets
// GOOGLE_TASKS_CALENDAR_ID to its ID. Tasks are stored as all-day events
// with a "[task] " prefix in the summary. Completion = delete event.
// Falls back to primary calendar if the env var is missing.

const TASK_PREFIX = "[task] ";

function tasksCalendarId(): string {
  return process.env.GOOGLE_TASKS_CALENDAR_ID || "primary";
}

function todayIST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
}

function nextDay(dateYmd: string): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type TaskItem = {
  id: string;
  title: string;
  date: string;
};

export type CreateTaskParams = {
  title: string;
  dueDate?: string;
};

export async function createTask(params: CreateTaskParams): Promise<TaskItem> {
  const calendar = getCalendarClient();
  const due = params.dueDate ?? todayIST();

  const res = await calendar.events.insert({
    calendarId: tasksCalendarId(),
    requestBody: {
      summary: `${TASK_PREFIX}${params.title}`,
      start: { date: due },
      end: { date: nextDay(due) },
      transparency: "transparent",
    },
  });

  return {
    id: res.data.id ?? "",
    title: params.title,
    date: due,
  };
}

export async function listTasks(): Promise<TaskItem[]> {
  const calendar = getCalendarClient();
  const now = new Date();
  const back = new Date(now.getTime() - 30 * 86400000);
  const fwd = new Date(now.getTime() + 365 * 86400000);

  const res = await calendar.events.list({
    calendarId: tasksCalendarId(),
    timeMin: back.toISOString(),
    timeMax: fwd.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (res.data.items ?? [])
    .filter((i) => (i.summary ?? "").startsWith(TASK_PREFIX))
    .map((i) => ({
      id: i.id ?? "",
      title: (i.summary ?? "").slice(TASK_PREFIX.length),
      date: i.start?.date ?? "",
    }));
}

export async function completeTask(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: tasksCalendarId(),
    eventId,
  });
}
