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

export type WhatsAppSendIntent = {
  type: "whatsapp_send";
  recipient_query: string;
  message_body: string;
};

export type WhatsAppReadIntent = {
  type: "whatsapp_read";
  recipient_query: string;
};

export type TaskIntent =
  | { type: "research" }
  | { type: "blinkit_order"; items: OrderItem[] }
  | { type: "calendar"; action: CalendarAction }
  | WhatsAppSendIntent
  | WhatsAppReadIntent;

export const THOUGHT_TAGS = [
  "product",
  "personal",
  "idea",
  "followup",
  "gripe",
  "person",
  "decision",
  "question",
  "reference",
] as const;

export type ThoughtTag = (typeof THOUGHT_TAGS)[number];

export type EntryClassification = {
  entry_type: "thought" | "task";
  tags: ThoughtTag[];
  confidence: number;
};

export async function classifyEntry(input: string): Promise<EntryClassification> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify a user's input from a personal hotkey overlay as either a "thought" or a "task".

THOUGHT = a note, idea, observation, reflection, reminder-to-self, gripe, question for later. The user is getting something out of their head. They do NOT want Eva to act on it now.

TASK = an imperative command for Eva to research, order, schedule, send, look up, summarize, or otherwise act NOW.

Disambiguation rules:
- Imperative verb at the start (find, book, send, order, schedule, list, summarize, check, what is, what did, look up, text, message, msg, dm, ping, whatsapp, wa, tell, reply, email, call) → task
- Messaging intent ("text X on group Y", "send X to Y", "message Y saying X", "dm Y", "ping Y", "tell Y to ...") → task, even if the message body sounds casual ("goodnight", "thanks", "ok"). The casual word is the payload, not a thought.
- Declarative, past tense, or self-directed ("I should", "remember", "remind me", "X is broken", "wonder if") → thought
- When genuinely ambiguous, prefer "thought" — the user can promote it later. Avoid false-positive task execution.

If thought, assign 0–3 tags from this exact fixed vocabulary (no other tags allowed):
product, personal, idea, followup, gripe, person, decision, question, reference

If task, return tags as an empty array.

Confidence is your own 0..1 estimate of how sure you are about entry_type.

Output ONLY valid JSON:
{"entry_type":"thought"|"task","tags":[...],"confidence":0..1}

Examples:
"find best ANC headphones under $300" → {"entry_type":"task","tags":[],"confidence":0.95}
"sarah owes me $200" → {"entry_type":"thought","tags":["person","followup"],"confidence":0.9}
"onboarding feels broken — users skip step 2" → {"entry_type":"thought","tags":["product","idea"],"confidence":0.92}
"book table at Bestia friday 8pm" → {"entry_type":"task","tags":[],"confidence":0.98}
"what did cursor ship this week" → {"entry_type":"task","tags":[],"confidence":0.9}
"i should write a blog post about latency budgets" → {"entry_type":"thought","tags":["idea"],"confidence":0.93}
"remind me to call mom" → {"entry_type":"thought","tags":["personal","followup"],"confidence":0.9}
"summarize the linear thread on auth" → {"entry_type":"task","tags":[],"confidence":0.92}
"text goodnight on group Ghar:D" → {"entry_type":"task","tags":[],"confidence":0.95}
"message anuj saying running late" → {"entry_type":"task","tags":[],"confidence":0.95}
"dm sarah thanks for the help" → {"entry_type":"task","tags":[],"confidence":0.93}`,
      },
      { role: "user", content: input },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text) as {
      entry_type?: string;
      tags?: unknown;
      confidence?: unknown;
    };

    const entry_type: "thought" | "task" =
      parsed.entry_type === "thought" ? "thought" : "task";

    const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const tags = rawTags
      .filter((t): t is string => typeof t === "string")
      .filter((t): t is ThoughtTag =>
        (THOUGHT_TAGS as readonly string[]).includes(t)
      )
      .slice(0, 3);

    const confidence =
      typeof parsed.confidence === "number" &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
        ? parsed.confidence
        : 0.5;

    return {
      entry_type,
      tags: entry_type === "task" ? [] : tags,
      confidence,
    };
  } catch {
    return { entry_type: "task", tags: [], confidence: 0 };
  }
}

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

WHATSAPP SEND requests: send a WhatsApp message to someone (e.g. "message Rahul that I'm running late", "whatsapp Priya to confirm dinner", "text Mom I'll call later").
{"type":"whatsapp_send","recipient_query":"name or phone number","message_body":"the exact message to send"}

WHATSAPP READ requests: check WhatsApp messages, see what someone said, read a chat (e.g. "what did Rahul say last?", "show messages from Priya", "check my WhatsApp from Mom").
{"type":"whatsapp_read","recipient_query":"name or phone number"}

Everything else:
{"type":"research"}

Rules:
- For calendar times, use full ISO 8601 format with timezone offset (e.g. 2026-05-14T14:00:00+05:30)
- "tomorrow" means the next calendar day from current time
- Default event duration: 1 hour if not specified
- For update/delete, set eventId to "" — Eva will search for the event by eventSummary at execution time
- For blinkit: quantity defaults to 1 if not specified
- For whatsapp_send: message_body should be the natural message text, not a meta-description
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
