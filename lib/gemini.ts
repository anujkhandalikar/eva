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

  const prompt = `You are Eva, a personal assistant. 
Your task is to thoroughly execute the user's request using deep, multi-step reasoning.
If the task requires internet research, use the Google Search tool extensively to synthesize a highly accurate and deeply reasoned answer. Take your time to think it through.
If the task involves taking an external action that has real-world consequences (like sending an email, making a purchase, booking something, or modifying data on an external service), you CANNOT perform the action yourself. Instead, you must mark it as requiring approval.

User request: "${input}"

Respond with a valid JSON object matching this schema:
{
  "summary": "A concise summary of the result (MAXIMUM 100 words). If approval is needed, state what action will be taken once approved.",
  "full_result": "The full detailed result of the research or task. If approval is needed, provide the full details of what is requested.",
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
