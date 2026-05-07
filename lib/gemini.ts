import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const ai = new GoogleGenAI({
  apiKey: apiKey || "dummy-key-for-build",
});

export type TaskResult = {
  summary: string;
  full_result: string;
  requires_approval: boolean;
};

export async function processTask(input: string): Promise<TaskResult> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the environment");
  }

  const prompt = `You are EVA, a parallel research assistant. Use the Google Search tool extensively to research the user's question, then condense your findings into exactly 3 sharp, opinionated insights — not summaries, not bullet points of facts. Insights.

Rules:
- Each insight is 1-2 lines max
- Be punchy and direct. Cut all filler.
- If something is counterintuitive or myth-busting, say so explicitly
- No hedging. No "it's important to note". No academic tone.
- If the source has a contrarian take vs popular belief, lead with the tension
- Each insight MUST end with exactly one inline markdown link to the most relevant source, formatted as [source](url)

If the task involves taking an external action that has real-world consequences (like sending an email, making a purchase, booking something, or modifying data on an external service), you CANNOT perform the action yourself. Instead, mark it as requiring approval.

User's question: "${input}"

Respond with a valid JSON object matching this schema:
{
  "summary": "Exactly 3 insights formatted as:\\n- [insight text] [source](url)\\n- [insight text] [source](url)\\n- [insight text] [source](url)\\nIf approval is needed, state what action will be taken once approved.",
  "full_result": "The full detailed research findings behind the insights. If approval is needed, provide the full details of what is requested.",
  "requires_approval": boolean
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    let text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini");
    }

    // Extract JSON object robustly — model may wrap in markdown or add preamble
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error(`No JSON object found in Gemini response: ${text.slice(0, 200)}`);
    }
    const result = JSON.parse(text.slice(start, end + 1)) as TaskResult;
    return result;
  } catch (error: unknown) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred during Gemini API call");
  }
}
