import { processTask } from "./lib/gemini";

async function run() {
  try {
    const result = await processTask("Test task: tell me a fun fact about the moon.");
    console.log("Success:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}
run();
