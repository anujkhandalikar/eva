import OpenAI from "openai";
import { EVA_CONTEXT, isAboutEva } from "./evaContext";

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

export type CalendarDeleteRangeAction = {
  type: "delete_range";
  timeMin: string;
  timeMax: string;
  query?: string;
};

export type CalendarTaskCreateAction = {
  type: "task_create";
  title: string;
  dueDate?: string;
};

export type CalendarTaskListAction = {
  type: "task_list";
};

export type CalendarAction =
  | CalendarListAction
  | CalendarCreateAction
  | CalendarUpdateAction
  | CalendarDeleteAction
  | CalendarDeleteRangeAction
  | CalendarTaskCreateAction
  | CalendarTaskListAction;

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

export const TASK_CATEGORIES = [
  "research",
  "action",
  "personal",
  "work",
  "learning",
  "other",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export type EntryClassification = {
  entry_type: "thought" | "task";
  tags: ThoughtTag[];
  category: TaskCategory | null;
  confidence: number;
};

export async function captionImage(imageUrl: string): Promise<string> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Caption this image in one short line (under 14 words). Capture the gist — what it shows, key text, who/what is in it. No prefix like 'Image of' or 'This is'. Plain text only.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 80,
  });

  const caption = response.choices[0]?.message?.content?.trim() ?? "";
  return caption.replace(/^["']|["']$/g, "");
}

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
- Explicit to-do markers ("todo:", "task:", "add task", "add to my list", "to-do", "what's on my list", "show my todos") → task. Eva tracks these in the user's task list.
- Declarative, past tense, or self-directed ("I should", "remember", "X is broken", "wonder if") → thought
- "remind me to X" without an explicit time → task (goes to the user's task list). With a specific time ("remind me at 3pm") → task (scheduled calendar event).
- When genuinely ambiguous, prefer "thought" — the user can promote it later. Avoid false-positive task execution.

If thought, assign 0–3 tags from this exact fixed vocabulary (no other tags allowed):
product, personal, idea, followup, gripe, person, decision, question, reference

If task, return tags as an empty array.

If task, ALSO assign a category from this fixed vocabulary:
- research: look-ups, summaries, web research, comparisons, recommendations
- action: bookings, orders, sends, messages, calendar create/update/delete
- personal: health, family, home, life-logistics tasks ("call mom", "renew passport")
- work: project, code, professional ("ship feature X", "review PR", "summarize standup")
- learning: study, explore-a-concept, idea-development ("explain CRDT", "how does X work")
- other: doesn't fit any of the above

If thought, set category to null.

Confidence is your own 0..1 estimate of how sure you are about entry_type.

Output ONLY valid JSON:
{"entry_type":"thought"|"task","tags":[...],"category":"research"|"action"|"personal"|"work"|"learning"|"other"|null,"confidence":0..1}

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
      category?: unknown;
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

    const category: TaskCategory | null =
      entry_type === "task" &&
      typeof parsed.category === "string" &&
      (TASK_CATEGORIES as readonly string[]).includes(parsed.category)
        ? (parsed.category as TaskCategory)
        : entry_type === "task"
          ? "other"
          : null;

    const confidence =
      typeof parsed.confidence === "number" &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
        ? parsed.confidence
        : 0.5;

    return {
      entry_type,
      tags: entry_type === "task" ? [] : tags,
      category,
      confidence,
    };
  } catch {
    return { entry_type: "task", tags: [], category: "other", confidence: 0 };
  }
}

export async function classifyCategory(input: string): Promise<TaskCategory> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify a task into ONE category. Output JSON: {"category":"<name>"}.

Categories:
- research: look-ups, summaries, web research, comparisons, recommendations ("find best ANC headphones", "what did cursor ship", "compare A vs B")
- action: bookings, orders, sends, messages, calendar create/update/delete ("book table", "order milk", "text mom", "schedule meeting")
- personal: health, family, home, life-logistics ("call mom", "renew passport", "doctor appointment")
- work: project, code, professional ("ship feature X", "review PR", "summarize standup")
- learning: study, explore-a-concept, idea-development ("explain CRDT", "how does X work", "teach me Y")
- other: doesn't fit any of the above

Tie-breakers:
- "personal" beats "action" when the task is primarily about someone in the user's life (call/text mom → personal, not action).
- "research" beats "learning" for one-off look-ups; "learning" wins when user wants conceptual understanding.
- Default ambiguous → other.`,
      },
      { role: "user", content: input },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text) as { category?: string };
    if (
      typeof parsed.category === "string" &&
      (TASK_CATEGORIES as readonly string[]).includes(parsed.category)
    ) {
      return parsed.category as TaskCategory;
    }
  } catch {}
  return "other";
}

const WHATSAPP_SEND_PREFIX_RE =
  /^\s*(text|msg|message|dm|ping|whatsapp|wa|tell|ask|send)\s+(?:on\s+)?([^,:]+?)\s*[,:]\s*(.+)$/i;

export async function detectIntent(input: string): Promise<TaskIntent> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prefixMatch = input.match(WHATSAPP_SEND_PREFIX_RE);
  if (prefixMatch) {
    const recipient_query = prefixMatch[2].trim();
    const message_body = prefixMatch[3].trim();
    if (recipient_query && message_body) {
      return { type: "whatsapp_send", recipient_query, message_body };
    }
  }

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

For CALENDAR DELETE (cancelling/removing a SINGLE named event), respond:
{"type":"calendar","action":{"type":"delete","eventId":"","eventSummary":"name of event to delete"}}

For CALENDAR DELETE RANGE (clearing ALL events in a time window — "clear my calendar today", "cancel everything tomorrow", "delete all meetings this week", "wipe Friday afternoon"), respond:
{"type":"calendar","action":{"type":"delete_range","timeMin":"<ISO datetime>","timeMax":"<ISO datetime>","query":"optional search filter"}}

TASK requests (Google Tasks — all-day todo). Trigger ONLY when the input STARTS with an explicit todo prefix: "todo", "todo:", "todo ", "task:", "add task", "add to my list", "to-do". No prefix → NEVER task_create. Even reminders without an explicit time go to calendar CREATE (not task_create).

For TASK CREATE, respond:
{"type":"calendar","action":{"type":"task_create","title":"task text (strip the todo prefix)","dueDate":"YYYY-MM-DD or omit for today"}}

For TASK LIST ("what's on my list", "show my todos", "open tasks", "what do I need to do"):
{"type":"calendar","action":{"type":"task_list"}}

BLINKIT ORDER requests: order, buy, or get grocery/food/household items delivered.
{"type":"blinkit_order","items":[{"name":"item name","quantity":1}]}

WHATSAPP SEND requests: send a WhatsApp message to someone (e.g. "message Rahul that I'm running late", "whatsapp Priya to confirm dinner", "text Mom I'll call later").
{"type":"whatsapp_send","recipient_query":"name or phone number","message_body":"the exact message to send"}

WHATSAPP READ requests: check WhatsApp messages, see what someone said, read a chat (e.g. "what did Rahul say last?", "show messages from Priya", "check my WhatsApp from Mom").
{"type":"whatsapp_read","recipient_query":"name or phone number"}

Everything else:
{"type":"research"}

Routing default (no prefix, no explicit time): personal action items naming a specific person or concrete action ("call venkat", "pay rent", "pick up package", "drop laundry", "remind me to renew passport") → CALENDAR CREATE with default time (today's next round hour, 1hr). Research lookups ("find best X", "what is Y", "compare A vs B", "summarize Z") → research.

Rules:
- For calendar times, use full ISO 8601 format with timezone offset (e.g. 2026-05-14T14:00:00+05:30)
- "tomorrow" means the next calendar day from current time
- Default event duration: 1 hour if not specified
- For calendar CREATE with no explicit time given ("remind me to call dad", "call venkat later"), still create the event — set startTime to today's next round hour (current hour + 1, minute 00), endTime +1 hour
- For update/delete, set eventId to "" — Eva will search for the event by eventSummary at execution time
- For delete_range, set timeMin/timeMax covering the requested window in IST (e.g. "today" → today 00:00 to today 23:59:59 IST). Use query only when user specifies a filter ("delete all gym events tomorrow" → query "gym"); omit otherwise.
- For task_create, dueDate is YYYY-MM-DD (Asia/Kolkata). Omit to default to today.
- For blinkit: quantity defaults to 1 if not specified
- For whatsapp_send: message_body should be the natural message text, not a meta-description
- Only respond with valid JSON, no other text

Examples:
"remind me to call venkat at 6pm today" → {"type":"calendar","action":{"type":"create","summary":"call venkat","startTime":"<today>T18:00:00+05:30","endTime":"<today>T19:00:00+05:30"}}
"call dad at 3pm tomorrow" → calendar create
"meeting with anuj friday 11am" → calendar create
"remind me to renew passport" → calendar create (default to next round hour today)
"todo: buy milk" → task_create, title "buy milk"
"todo buy milk" → task_create, title "buy milk"
"add task pay rent" → task_create
"what's on my list" → task_list
"clear all events on my calendar today" → {"type":"calendar","action":{"type":"delete_range","timeMin":"<today>T00:00:00+05:30","timeMax":"<today>T23:59:59+05:30"}}
"cancel everything tomorrow" → {"type":"calendar","action":{"type":"delete_range","timeMin":"<tomorrow>T00:00:00+05:30","timeMax":"<tomorrow>T23:59:59+05:30"}}
"delete all gym events this week" → {"type":"calendar","action":{"type":"delete_range","timeMin":"<weekStart>T00:00:00+05:30","timeMax":"<weekEnd>T23:59:59+05:30","query":"gym"}}`,
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
  subtype?: ResearchSubtype;
};

export const RESEARCH_SUBTYPES = [
  "opinion",
  "recommend",
  "compare",
  "explain",
  "lookup",
] as const;

export type ResearchSubtype = (typeof RESEARCH_SUBTYPES)[number];

export async function classifyResearchSubtype(
  input: string
): Promise<ResearchSubtype> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Classify a research request into ONE subtype. Output JSON: {"subtype":"<name>"}.

Subtypes:
- opinion: user wants a verdict/judgment on a thing, person, company, or trend. "is X overhyped", "thoughts on Y", "what's the deal with Z", "who is <person>".
- recommend: user wants picks/ranked options for a buying or choice decision. "best ANC headphones under $300", "good restaurants in koramangala", "which framework should I use for X".
- compare: user pits ≥2 named things against each other. "temporal vs inngest", "compare A and B", "X or Y for <use case>".
- explain: user wants a concept, mechanism, or how-to explained. "how does CRDT merge work", "what is OAuth PKCE", "how do I rotate AWS keys", "explain transformer attention".
- lookup: user wants ONE specific fact/number/date or a recent news ping. "sunset time bangalore today", "current price of nvda", "what did cursor ship this week", "stock market holidays may 2026".

Tie-breakers:
- If unsure between explain and lookup → lookup if answer fits one sentence/number, else explain.
- If unsure between opinion and recommend → recommend if input names a budget/category to pick from, opinion if it asks for a take on a single named thing.
- Default for vague/ambiguous: opinion.`,
      },
      { role: "user", content: input },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text) as { subtype?: string };
    if (
      typeof parsed.subtype === "string" &&
      (RESEARCH_SUBTYPES as readonly string[]).includes(parsed.subtype)
    ) {
      return parsed.subtype as ResearchSubtype;
    }
  } catch {}
  return "opinion";
}

const BANNED_WORDS_LINE = `BANNED WORDS — rewrite the line if any appear: prominent, significant, instrumental, notable, key, major, important, various, several, impactful, dynamic, robust, renowned, extensive, substantial, multidisciplinary, affiliated`;

const LINK_RULE_ONE = `LINK RULE:
- Include AT MOST ONE markdown link in the summary, attached to the bullet it best supports.
- Link must be a real https:// URL. Label = publication or site name (e.g. [TechCrunch](https://...)), never "source".
- If no real URL available, omit the link. Do not fabricate.`;

const NO_HEDGING = `- No hedging ("might", "could be", "arguably"). State it.
- Only cite facts you actually found — no plausible-sounding inventions.`;

function promptForSubtype(subtype: ResearchSubtype, input: string): string {
  const tail = `

User's question: "${input}"

Respond with ONLY valid JSON (no prose, no code fences):
{"summary":"<markdown bullets>","full_result":"<longer findings>","requires_approval":false}

Set requires_approval to true ONLY if the task involves a real external action (email, purchase, booking, modifying external data). For pure research, it's false.`;

  switch (subtype) {
    case "opinion":
      return `You are EVA. Research the web, then deliver a 3-bullet opinionated brief on the subject.

SEARCH:
- ≥2 searches. Include one with recency push ("2025", "latest", "this week").
- People: general web + site:linkedin.com. Skip medical directories unless the query is medical.
- Products/companies: find the most recent announcement, not the homepage blurb.
- If multiple people share a name, pick the most contextually relevant one and flag the ambiguity in bullet 1.

OUTPUT — exactly 3 bullets, no labels or prefixes:
- A specific claim. Overhyped? Niche? Stalled? Genuinely useful? Don't describe — judge.
- One concrete data point — number, date, round size, ship, outcome. If you can't name it, search more.
- What most people miss — a limitation, contradiction, recent setback, reframing.

${LINK_RULE_ONE}

${BANNED_WORDS_LINE}

RULES:
- 1–2 sentences per bullet.
${NO_HEDGING}${tail}`;

    case "recommend":
      return `You are EVA. Research the web, then deliver ranked picks for a buying/choice decision.

SEARCH:
- ≥2 searches: one for "best <category> <year>", one for credible reviews (RTINGS, Wirecutter, Reddit megathreads, expert YouTubers).
- Cross-reference at least 2 sources before picking.
- Respect any constraint in the input (budget, use case, region) — if a pick violates it, drop it.

OUTPUT — exactly 3 lines, no preamble:
- TOP PICK: <name> — <one-sentence why it wins for this user>.
- RUNNER-UP: <name> — <one-sentence why it's the alternative and for whom>.
- SKIP: <name or category> — <one-sentence why a common recommendation doesn't fit here>.

${LINK_RULE_ONE}

${BANNED_WORDS_LINE}

RULES:
- Name actual products/places, not generic categories.
- If price/budget given, every pick must respect it.
${NO_HEDGING}${tail}`;

    case "compare":
      return `You are EVA. Research the web, then compare the named options head-to-head.

SEARCH:
- ≥2 searches: one per option, one for "<A> vs <B>" if relevant.
- Find the most recent state of each (last update, latest pricing, current feature gap).

OUTPUT — exactly 3 bullets:
- WHERE A WINS: <one concrete axis where A clearly beats B, with the specific reason>.
- WHERE B WINS: <one concrete axis where B clearly beats A, with the specific reason>.
- PICK <A or B> IF: <the deciding question — name the use case that tips it, and which option wins for it>.

${LINK_RULE_ONE}

${BANNED_WORDS_LINE}

RULES:
- Use the actual names of the options from the user's input.
- Comparisons must be concrete (numbers, features, behaviors), not adjectives.
${NO_HEDGING}${tail}`;

    case "explain":
      return `You are EVA. Explain the concept or how-to clearly and tightly. Search the web if the topic is technical or recent enough that you'd risk staleness.

OUTPUT — choose the shape that fits:
- For a concept: 3 bullets. Internally use the frame WHAT IT IS / HOW IT WORKS / WHY IT MATTERS to shape each bullet, but DO NOT include those labels in the output. Output only the three plain sentences, one per bullet.
- For a how-to: numbered steps (3–6), each ≤ 1 short sentence, imperative voice.

NEVER use markdown bold (**), italics (*), or label prefixes like "WHAT IT IS:" in output. Plain prose only.

${LINK_RULE_ONE}

${BANNED_WORDS_LINE}

RULES:
- Lead with the answer. No "Great question" or "In this guide".
- Plain words. Jargon only when it's the actual term of art, and then define it inline once.
- No filler context paragraphs.
${NO_HEDGING}${tail}`;

    case "lookup":
      return `You are EVA. Find ONE specific fact or the latest news ping. Search the web — pick the most authoritative current source.

SEARCH:
- For prices, times, dates, scores: official source > major publication > aggregator. Never a content farm.
- For "what did X ship/launch/announce": the company blog or a top-tier outlet from this week.

OUTPUT:
- For a single fact: ONE line. The answer first, then a short qualifier if needed (as of <date/time>, source name).
- For a news ping: 1–2 bullets. The headline fact, then optionally one detail.

${LINK_RULE_ONE}

${BANNED_WORDS_LINE}

RULES:
- Lead with the number/answer. Do not pad.
- If the fact is time-sensitive, include the timestamp or "as of <date>".
${NO_HEDGING}${tail}`;
  }
}

export async function processTask(input: string): Promise<TaskResult> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const subtype = await classifyResearchSubtype(input);
  console.log(`[research-subtype] "${input}" → ${subtype}`);

  const basePrompt = promptForSubtype(subtype, input);
  const selfReferential = isAboutEva(input);
  if (selfReferential) console.log(`[eva-self] "${input}" → injecting self-context`);

  const prompt = selfReferential
    ? `ABOUT CHOTU (the product the user is asking about — ignore any external product with a similar name):
${EVA_CONTEXT}

The user is asking about Chotu itself — this is brainstorming about Chotu's own roadmap, features, or design. Answer ONLY from the context above. Do not use web search results or training data about any other product named Chotu or Eva.

---

${basePrompt}`
    : basePrompt;

  const response = await client.responses.create({
    model: "gpt-4o",
    tools: selfReferential ? [] : [{ type: "web_search_preview" }],
    input: prompt,
  });

  const text = response.output_text;
  if (!text) throw new Error("No text returned from OpenAI");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON found in response: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as TaskResult;
  return { ...parsed, subtype };
}
