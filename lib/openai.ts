import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey || "dummy-key-for-build",
});

export type TaskResult = {
  summary: string;
  full_result: string;
  requires_approval: boolean;
};

export async function processTask(input: string): Promise<TaskResult> {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const prompt = `You are EVA, a parallel research assistant. Search the web extensively to research the user's question, then condense your findings into exactly 3 sharp, opinionated insights — not summaries, not bullet points of facts. Insights.

Rules:
- Each insight is 1-2 lines max
- Be punchy and direct. Cut all filler.
- If something is counterintuitive or myth-busting, say so explicitly
- No hedging. No "it's important to note". No academic tone.
- If the source has a contrarian take vs popular belief, lead with the tension
- Each insight MUST end with exactly one inline markdown link to the most relevant source, formatted as [source](url)

If the task involves taking an external action that has real-world consequences (like sending an email, making a purchase, booking something, or modifying data on an external service), mark it as requiring approval.

User's question: "${input}"

Respond with ONLY a valid JSON object:
{
  "summary": "Exactly 3 insights formatted as:\\n- [insight text] [source](url)\\n- [insight text] [source](url)\\n- [insight text] [source](url)",
  "full_result": "Full detailed research findings behind the insights.",
  "requires_approval": false
}`;

  const response = await client.responses.create({
    model: "gpt-4o-mini",
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
