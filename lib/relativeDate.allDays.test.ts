// Exhaustive cross-anchor tests: every relative phrase, evaluated against all
// seven possible "today" weekdays. Uses invariants (correct weekday + correct
// day-offset window) rather than hardcoded dates, so it proves the resolver is
// right for ANY day, not just the Sunday from the bug report.
//
// Run: npx tsx --test lib/relativeDate.allDays.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelativeDate } from "./relativeDate";

const MS_PER_DAY = 86_400_000;

// 2026-06-14 is a Sunday → this week covers every weekday exactly once.
const WEEK: { name: string; iso: string; dow: number }[] = [
  { name: "Sunday", iso: "2026-06-14T12:00:00+05:30", dow: 0 },
  { name: "Monday", iso: "2026-06-15T12:00:00+05:30", dow: 1 },
  { name: "Tuesday", iso: "2026-06-16T12:00:00+05:30", dow: 2 },
  { name: "Wednesday", iso: "2026-06-17T12:00:00+05:30", dow: 3 },
  { name: "Thursday", iso: "2026-06-18T12:00:00+05:30", dow: 4 },
  { name: "Friday", iso: "2026-06-19T12:00:00+05:30", dow: 5 },
  { name: "Saturday", iso: "2026-06-20T12:00:00+05:30", dow: 6 },
];

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function utcOf(civil: string): number {
  const [y, m, d] = civil.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function dowOf(civil: string): number {
  return new Date(utcOf(civil)).getUTCDay();
}
function deltaDays(anchorCivil: string, resultCivil: string): number {
  return Math.round((utcOf(resultCivil) - utcOf(anchorCivil)) / MS_PER_DAY);
}
function resolve(phrase: string, anchorIso: string): string {
  const r = resolveRelativeDate(phrase, new Date(anchorIso));
  assert.ok(r !== null, `expected a date for "${phrase}" @ ${anchorIso}, got null`);
  return r;
}

for (const anchor of WEEK) {
  const anchorCivil = anchor.iso.slice(0, 10);

  test(`[${anchor.name}] today / tomorrow / day-after`, () => {
    assert.equal(deltaDays(anchorCivil, resolve("do it today", anchor.iso)), 0);
    assert.equal(deltaDays(anchorCivil, resolve("do it tomorrow", anchor.iso)), 1);
    assert.equal(deltaDays(anchorCivil, resolve("day after tomorrow", anchor.iso)), 2);
  });

  test(`[${anchor.name}] in N days / N days from now / in N weeks`, () => {
    for (const n of [0, 1, 3, 5, 10, 21]) {
      assert.equal(deltaDays(anchorCivil, resolve(`in ${n} days`, anchor.iso)), n);
      assert.equal(deltaDays(anchorCivil, resolve(`${n} days from now`, anchor.iso)), n);
    }
    assert.equal(deltaDays(anchorCivil, resolve("in a week", anchor.iso)), 7);
    assert.equal(deltaDays(anchorCivil, resolve("next week", anchor.iso)), 7);
    for (const n of [1, 2, 4]) {
      assert.equal(deltaDays(anchorCivil, resolve(`in ${n} weeks`, anchor.iso)), n * 7);
      assert.equal(deltaDays(anchorCivil, resolve(`${n} weeks from now`, anchor.iso)), n * 7);
    }
  });

  for (let target = 0; target < 7; target++) {
    const wd = WEEKDAY_NAMES[target];

    test(`[${anchor.name}] this/bare "${wd}" → upcoming, delta 0..6`, () => {
      for (const phrase of [`this ${wd}`, `meet on ${wd}`]) {
        const r = resolve(phrase, anchor.iso);
        assert.equal(dowOf(r), target, `${phrase}: wrong weekday`);
        const d = deltaDays(anchorCivil, r);
        assert.ok(d >= 0 && d <= 6, `${phrase}: delta ${d} out of [0,6]`);
      }
    });

    test(`[${anchor.name}] next "${wd}" → next week, delta 7..13`, () => {
      const r = resolve(`next ${wd}`, anchor.iso);
      assert.equal(dowOf(r), target, "wrong weekday");
      const d = deltaDays(anchorCivil, r);
      assert.ok(d >= 7 && d <= 13, `delta ${d} out of [7,13]`);
    });

    test(`[${anchor.name}] last "${wd}" → past, delta -7..-1`, () => {
      const r = resolve(`last ${wd}`, anchor.iso);
      assert.equal(dowOf(r), target, "wrong weekday");
      const d = deltaDays(anchorCivil, r);
      assert.ok(d >= -7 && d <= -1, `delta ${d} out of [-7,-1]`);
    });
  }

  test(`[${anchor.name}] weekend lands on Sat/Sun, this >= today`, () => {
    const thisWk = resolve("trip this weekend", anchor.iso);
    assert.ok(dowOf(thisWk) === 6 || dowOf(thisWk) === 0, "this weekend not a weekend day");
    assert.ok(deltaDays(anchorCivil, thisWk) >= 0, "this weekend in the past");

    const nextWk = resolve("trip next weekend", anchor.iso);
    assert.ok(dowOf(nextWk) === 6 || dowOf(nextWk) === 0, "next weekend not a weekend day");
    assert.ok(
      deltaDays(anchorCivil, nextWk) > deltaDays(anchorCivil, thisWk),
      "next weekend not after this weekend"
    );
  });
}

test("reschedule 'from X to Y' resolves to Y (the day after 'to'), not X", () => {
  for (const anchor of WEEK) {
    const anchorCivil = anchor.iso.slice(0, 10);
    const r = resolve("move standup from monday to friday", anchor.iso);
    assert.equal(dowOf(r), 5, `${anchor.name}: expected Friday`);
    const d = deltaDays(anchorCivil, r);
    assert.ok(d >= 0 && d <= 6, `${anchor.name}: delta ${d} out of [0,6]`);
  }
  // 'to next friday' still honours the next-week semantics.
  const nx = resolve("move it to next friday", WEEK[4].iso); // Thursday anchor
  assert.equal(dowOf(nx), 5);
  assert.ok(deltaDays(WEEK[4].iso.slice(0, 10), nx) >= 7);
});

test("the exact bug scenario stays fixed across the anchor week", () => {
  // 'this sunday' must always resolve to a Sunday, 0..6 days out.
  for (const anchor of WEEK) {
    const r = resolve("setup an event this sunday at 9am", anchor.iso);
    assert.equal(dowOf(r), 0, `${anchor.name}: 'this sunday' not a Sunday`);
  }
});

test("no relative phrase → null", () => {
  assert.equal(resolveRelativeDate("meet kevin on june 30", new Date(WEEK[0].iso)), null);
  assert.equal(resolveRelativeDate("call the bank about my loan", new Date(WEEK[0].iso)), null);
});
