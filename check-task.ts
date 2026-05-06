import { supabase } from "./lib/supabase";

async function run() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", "87b7861d-ec5f-4032-a55d-97cfabd32831")
    .single();

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Task result:");
    console.log(data);
  }
}
run();
