import { readFileSync } from "node:fs";
import { join } from "node:path";

export const EVA_CONTEXT = readFileSync(
  join(process.cwd(), "lib", "evaContext.md"),
  "utf8"
);

const EVA_MENTION = /\beva\b/i;

export function isAboutEva(input: string): boolean {
  return EVA_MENTION.test(input);
}
