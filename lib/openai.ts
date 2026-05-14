import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey || "dummy-key-for-build",
});

export type OrderItem = { name: string; quantity: number };

export type CalendarListAction = {
  type: "list";
  timeMin: string;
  timeMax: string;
  query?: string;
};

export type CalendarCreateAction = {
  type: "create";
  summary: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees?: string[];
};

export type CalendarUpdateAction = {
  type: "update";
  eventId: string;
  eventSummary: string;
  summary?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
};

export type CalendarDeleteAction = {
  type: "delete";
  eventId: string;
  eventSummary: string;
};

export type CalendarAction =
  | CalendarListAction
  | CalendarCreateAction
  | CalendarUpdateAction
  | CalendarDeleteAction;

export type TaskIntent =
  | { type: "research" }
  | { type: "blinkit_order"; items: OrderItem[] }
  | { type: "calendar"; action: CalendarAction };

export async function detectIntent(input: string): Promise<TaskIntent> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const nowDate = new Date();
  const nowISO = nowDate.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T") + "+05:30";
  const dayName = nowDate.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "long" });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify user requests. Current time: ${nowISO} (${dayName}, Asia/Kolkata, UTC+5:30). All calendar times must use IST (UTC+5:30) offset.

CALENDAR requests: anything about viewing, adding, editing, rescheduling, cancelling, or deleting calendar events.

For CALENDAR LIST (viewing/checking schedule), respond:
{"type":"calendar","action":{"type":"list","timeMin":"<ISO datetime>","timeMax":"<ISO datetime>","query":"optional search term"}}

For CALENDAR CREATE (adding/scheduling), respond:
{"type":"calendar","action":{"type":"create","summary":"event title","startTime":"<ISO datetime>","endTime":"<ISO datetime>","description":"optional","location":"optional","attendees":["email@example.com"]}}

For CALENDAR UPDATE (rescheduling/editing an existing event), respond:
{"type":"calendar","action":{"type":"update","eventId":"","eventSummary":"name of event to update","summary":"new title if changing","startTime":"<ISO datetime if changing>","endTime":"<ISO datetime if changing>"}}

For CALENDAR DELETE (cancelling/removing), respond:
{"type":"calendar","action":{"type":"delete","eventId":"","eventSummary":"name of event to delete"}}

BLINKIT ORDER requests: order, buy, or get grocery/food/household items delivered.
{"type":"blinkit_order","items":[{"name":"item name","quantity":1}]}

Everything else:
{"type":"research"}

Rules:
- For calendar times, use full ISO 8601 format with timezone offset (e.g. 2026-05-14T14:00:00+05:30)
- "tomorrow" means the next calendar day from current time
- Default event duration: 1 hour if not specified
- For update/delete, set eventId to "" — Eva will search for the event by eventSummary at execution time
- For blinkit: quantity defaults to 1 if not specified
- Only respond with valid JSON, no other text`,
      },
      { role: "user", content: input },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '{"type":"research"}';
  try {
    return JSON.parse(text) as TaskIntent;
  } catch {
    return { type: "research" };
  }
}

export type TaskResult = {
  summary: string;
  full_result: string;
  requires_approval: boolean;
};

export async function processTask(input: string): Promise<TaskResult> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `You are EVA. Search the web for the MOST RECENT information, then deliver a 3-bullet opinionated brief.

SEARCH STRATEGY:
- Run at least 2 searches. Include a recency-focused search (e.g. append "2024" or "2025" or "latest").
- For people: search general web + "site:linkedin.com [name]". Skip medical directories (vitals.com, healthgrades.com, zocdoc.com, doximity.com) unless the query mentions healthcare.
- For products/companies: find the most recent announcement, launch, or update — not the homepage description.
- If multiple people share the name, pick the most contextually relevant one and flag the ambiguity in bullet 1.

OUTPUT — exactly 3 bullets:
- VERDICT: make a specific claim. Name the thing, judge it. Overhyped, niche, genuinely useful, stalled? Don't describe — evaluate.
- SHARPEST FACT: one concrete data point. A number, date, funding round, specific project, specific outcome. If you can't name it exactly, keep searching.
- THE CATCH: the thing most people miss. A limitation, contradiction, recent setback, or reframing detail.

LINK RULE:
- Include exactly ONE markdown link in the entire summary — attach it to whichever bullet it best supports.
- The link must be a real, full URL starting with https://
- Use the publication or site name as the link label (e.g. [TechCrunch](https://...) not [source](https://...))
- If you cannot find a real URL, omit the link entirely — do not fabricate one.

BANNED WORDS — rewrite the line if any appear:
prominent, significant, instrumental, notable, key, major, important, various, several, impactful, dynamic, robust, renowned, extensive, substantial, multidisciplinary, affiliated

RULES:
- Only cite facts you actually found — no plausible-sounding inventions
- 1-2 sentences per bullet max
- No hedging. Stand behind your read.

If the task involves a real-world external action (email, purchase, booking, modifying external data), set requires_approval to true.

User's question: "${input}"

Respond with ONLY valid JSON:
{
  "summary": "- [verdict sentence]\\n- [sharpest fact sentence] [SiteName](https://full-url)\\n- [the catch sentence]",
  "full_result": "Full research findings.",
  "requires_approval": false
}`;

  const response = await client.responses.create({
    model: "gpt-4o",
    tools: [{ type: "web_search_preview" }],
    input: prompt,
  });

  const text = response.output_text;
  if (!text) throw new Error("No text returned from OpenAI");

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
  }

  return JSON.parse(text.slice(start, end + 1)) as TaskResult;
}
