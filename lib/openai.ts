import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey || "dummy-key-for-build",
});

export type OrderItem = { name: string; quantity: number };
export type TaskIntent =
  | { type: "research" }
  | { type: "blinkit_order"; items: OrderItem[] };

export async function detectIntent(input: string): Promise<TaskIntent> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You classify user requests. If the request is asking to order, buy, or get grocery/food/household items delivered (e.g. from Blinkit, Zepto, Swiggy Instamart), respond with:
{"type":"blinkit_order","items":[{"name":"item name","quantity":1}]}

For everything else respond with:
{"type":"research"}

Rules:
- quantity defaults to 1 if not specified
- Be generous: "get me some Diet Coke" = blinkit_order
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
