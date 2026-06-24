// Deterministic relative-date resolution for calendar actions.
//
// The LLM (gpt-4o-mini) is unreliable at weekday/relative-date arithmetic — it
// once resolved "this sunday" to a Thursday. So we never trust the LLM's date:
// when the raw input contains a recognisable relative phrase, we compute the
// correct calendar date in code and splice it onto the LLM's chosen time-of-day.
//
// All civil-date math is done in Asia/Kolkata (IST, fixed UTC+5:30, no DST).

const IST_OFFSET = "+05:30";

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// Longer names first so "wednesday" matches before "wed".
const DAY_ALT = Object.keys(WEEKDAYS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const RE_DAY_AFTER_TOMORROW = /\bday\s+after\s+tomorrow\b/;
const RE_TOMORROW = /\b(tomorrow|tmrw|tmr)\b/;
const RE_TODAY = /\b(today|tonight)\b/;
const RE_IN_N_DAYS = /\bin\s+(\d+)\s+days?\b/;
const RE_N_DAYS_FROM_NOW = /\b(\d+)\s+days?\s+from\s+now\b/;
const RE_IN_N_WEEKS = /\bin\s+(\d+)\s+weeks?\b/;
const RE_N_WEEKS_FROM_NOW = /\b(\d+)\s+weeks?\s+from\s+now\b/;
const RE_IN_A_WEEK = /\bin\s+a\s+week\b/;
const RE_NEXT_WEEK = /\bnext\s+week\b/;
const RE_WEEKEND = /\b(this\s+|next\s+|the\s+)?weekend\b/;
const RE_LAST_WEEKDAY = new RegExp(`\\b(?:last|past|previous)\\s+(${DAY_ALT})\\b`);
const RE_NEXT_WEEKDAY = new RegExp(`\\bnext\\s+(${DAY_ALT})\\b`);
// Reschedule phrasing "...to friday": the target is the day after "to", not an
// earlier weekday in the sentence ("move standup from monday to friday").
const RE_TO_WEEKDAY = new RegExp(`\\bto\\s+(${DAY_ALT})\\b`);
const RE_THIS_WEEKDAY = new RegExp(`\\b(?:this\\s+)?(${DAY_ALT})\\b`);

const MS_PER_DAY = 86_400_000;

/** "YYYY-MM-DD" civil date of `d` in IST. */
export function istCivilDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
}

/** UTC-midnight timestamp for a "YYYY-MM-DD" civil date (used as a day cursor). */
function civilToUTC(civil: string): number {
  const [y, m, d] = civil.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** "YYYY-MM-DD" for a UTC-midnight timestamp. */
function utcToCivil(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Full ISO-8601 string in IST wall-clock for an absolute instant. */
function toISTISO(d: Date): string {
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T") + IST_OFFSET;
}

/**
 * Resolve a relative date phrase in `input` to a "YYYY-MM-DD" IST civil date,
 * relative to `anchor` (defaults to now). Returns null when no relative phrase
 * is present — absolute dates ("June 30", "on the 25th") are left to the LLM.
 *
 * Weekday semantics (best-guess, biased toward the future for scheduling):
 *   "this sunday" / bare "sunday" → nearest upcoming Sunday (today if it is Sunday)
 *   "next sunday"                 → the Sunday of next week (always +7 from upcoming)
 */
export function resolveRelativeDate(input: string, anchor: Date = new Date()): string | null {
  const text = input.toLowerCase();
  const anchorCivil = istCivilDate(anchor);
  const base = civilToUTC(anchorCivil);
  const anchorDay = new Date(base).getUTCDay();

  const fromDelta = (days: number): string => utcToCivil(base + days * MS_PER_DAY);

  // Order matters: most specific phrases first.
  if (RE_DAY_AFTER_TOMORROW.test(text)) return fromDelta(2);
  if (RE_TODAY.test(text)) return fromDelta(0);
  if (RE_TOMORROW.test(text)) return fromDelta(1);

  const weeksFromNow = RE_N_WEEKS_FROM_NOW.exec(text);
  if (weeksFromNow) return fromDelta(Number(weeksFromNow[1]) * 7);
  const inWeeks = RE_IN_N_WEEKS.exec(text);
  if (inWeeks) return fromDelta(Number(inWeeks[1]) * 7);

  const fromNow = RE_N_DAYS_FROM_NOW.exec(text);
  if (fromNow) return fromDelta(Number(fromNow[1]));
  const inDays = RE_IN_N_DAYS.exec(text);
  if (inDays) return fromDelta(Number(inDays[1]));

  if (RE_IN_A_WEEK.test(text) || RE_NEXT_WEEK.test(text)) return fromDelta(7);

  const weekend = RE_WEEKEND.exec(text);
  if (weekend) {
    const isNext = (weekend[1] ?? "").trim() === "next";
    const upcomingSat = (6 - anchorDay + 7) % 7; // 0 when today is Saturday
    if (!isNext) {
      // Sat/Sun already are the weekend → today; otherwise the coming Saturday.
      if (anchorDay === 0) return fromDelta(0);
      return fromDelta(upcomingSat);
    }
    // "next weekend": the Saturday of the following week.
    if (anchorDay === 0) return fromDelta(6); // Sunday → the coming Saturday
    if (anchorDay === 6) return fromDelta(7); // Saturday → Saturday next week
    return fromDelta(upcomingSat + 7);
  }

  // "last/past/previous <weekday>" → most recent past occurrence. Checked before
  // the bare-weekday rule so it isn't mis-resolved to a future date.
  const lastWd = RE_LAST_WEEKDAY.exec(text);
  if (lastWd) {
    const target = WEEKDAYS[lastWd[1]];
    const back = ((anchorDay - target + 7) % 7) || 7;
    return fromDelta(-back);
  }

  const nextWd = RE_NEXT_WEEKDAY.exec(text);
  if (nextWd) {
    const target = WEEKDAYS[nextWd[1]];
    return fromDelta(((target - anchorDay + 7) % 7) + 7);
  }

  const toWd = RE_TO_WEEKDAY.exec(text);
  if (toWd) {
    const target = WEEKDAYS[toWd[1]];
    return fromDelta((target - anchorDay + 7) % 7);
  }

  const thisWd = RE_THIS_WEEKDAY.exec(text);
  if (thisWd) {
    const target = WEEKDAYS[thisWd[1]];
    return fromDelta((target - anchorDay + 7) % 7);
  }

  return null;
}

/**
 * Given the LLM's start/end ISO datetimes, override the calendar DATE with the
 * deterministically-resolved one (when `input` carries a relative phrase),
 * preserving the LLM's time-of-day and the event's duration. No-op when no
 * relative phrase is found or the LLM already landed on the right date.
 */
export function applyResolvedDate(
  input: string,
  startTime: string,
  endTime: string | undefined,
  anchor: Date = new Date()
): { startTime: string; endTime?: string } {
  const resolved = resolveRelativeDate(input, anchor);
  if (!resolved) return { startTime, endTime };

  const startMs = Date.parse(startTime);
  if (Number.isNaN(startMs)) return { startTime, endTime };

  const llmStartCivil = istCivilDate(new Date(startMs));
  const deltaDays = Math.round((civilToUTC(resolved) - civilToUTC(llmStartCivil)) / MS_PER_DAY);
  if (deltaDays === 0) return { startTime, endTime };

  const shift = deltaDays * MS_PER_DAY;
  const newStart = toISTISO(new Date(startMs + shift));

  if (endTime === undefined) return { startTime: newStart };
  const endMs = Date.parse(endTime);
  if (Number.isNaN(endMs)) return { startTime: newStart, endTime };
  return { startTime: newStart, endTime: toISTISO(new Date(endMs + shift)) };
}
