/**
 * One-time backfill: classify category for every task row missing one.
 * Run: npx tsx scripts/backfill-categories.ts
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or
 * NEXT_PUBLIC_SUPABASE_ANON_KEY), OPENAI_API_KEY.
 */

import { supabase } from "../lib/supabase";
import { classifyCategory } from "../lib/openai";

async function main() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, input, entry_type, category")
    .eq("entry_type", "task")
    .is("category", null);

  if (error) {
    console.error("fetch failed:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("nothing to backfill");
    return;
  }

  console.log(`backfilling ${data.length} tasks...`);

  let done = 0;
  for (const row of data) {
    try {
      const category = await classifyCategory(row.input);
      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ category })
        .eq("id", row.id);
      if (updateErr) throw updateErr;
      done++;
      console.log(`[${done}/${data.length}] ${row.id} → ${category}`);
    } catch (e) {
      console.error(`failed ${row.id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`done. classified ${done}/${data.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
