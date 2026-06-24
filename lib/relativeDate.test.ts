// Run: npx tsx lib/relativeDate.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRelativeDate, applyResolvedDate } from "./relativeDate";

// Anchor: Thursday 2026-06-18, 11:27 IST — the exact scenario from the bug.
const THU = new Date("2026-06-18T11:27:00+05:30");

test("the original bug: 'this sunday' on a Thursday → 2026-06-21", () => {
  assert.equal(resolveRelativeDate("setup an event on this sunday to meet kevin at 9am", THU), "2026-06-21");
});

test("bare weekday resolves to nearest upcoming", () => {
  assert.equal(resolveRelativeDate("meet kevin sunday", THU), "2026-06-21");
  assert.equal(resolveRelativeDate("standup friday", THU), "2026-06-19");
  assert.equal(resolveRelativeDate("call mon", THU), "2026-06-22");
});

test("'this <weekday>' where today IS that weekday → today", () => {
  assert.equal(resolveRelativeDate("this thursday", THU), "2026-06-18");
});

test("'next <weekday>' is always next week's occurrence (+7 from upcoming)", () => {
  assert.equal(resolveRelativeDate("next sunday", THU), "2026-06-28");
  assert.equal(resolveRelativeDate("next thursday", THU), "2026-06-25");
  assert.equal(resolveRelativeDate("next friday", THU), "2026-06-26");
});

test("today / tonight / tomorrow / day after tomorrow", () => {
  assert.equal(resolveRelativeDate("lunch today", THU), "2026-06-18");
  assert.equal(resolveRelativeDate("dinner tonight", THU), "2026-06-18");
  assert.equal(resolveRelativeDate("gym tomorrow", THU), "2026-06-19");
  assert.equal(resolveRelativeDate("call day after tomorrow", THU), "2026-06-20");
});

test("in N days / N days from now / in a week / next week", () => {
  assert.equal(resolveRelativeDate("in 3 days", THU), "2026-06-21");
  assert.equal(resolveRelativeDate("5 days from now", THU), "2026-06-23");
  assert.equal(resolveRelativeDate("review in a week", THU), "2026-06-25");
  assert.equal(resolveRelativeDate("ship next week", THU), "2026-06-25");
});

test("weekend → upcoming Saturday; next weekend → +7", () => {
  assert.equal(resolveRelativeDate("trip this weekend", THU), "2026-06-20");
  assert.equal(resolveRelativeDate("trip next weekend", THU), "2026-06-27");
});

test("no relative phrase → null (absolute dates left to LLM)", () => {
  assert.equal(resolveRelativeDate("meet kevin on june 30", THU), null);
  assert.equal(resolveRelativeDate("call the bank", THU), null);
});

test("crossing a month boundary", () => {
  const fri = new Date("2026-06-26T10:00:00+05:30"); // Friday
  assert.equal(resolveRelativeDate("next monday", fri), "2026-07-06");
  assert.equal(resolveRelativeDate("in 5 days", fri), "2026-07-01");
});

test("applyResolvedDate overrides the LLM's wrong date, keeps time-of-day", () => {
  // LLM's buggy output: 9am on the wrong day (Thu 25th).
  const fixed = applyResolvedDate(
    "setup an event on this sunday to meet kevin at 9am",
    "2026-06-25T09:00:00+05:30",
    "2026-06-25T09:30:00+05:30",
    THU
  );
  assert.equal(fixed.startTime, "2026-06-21T09:00:00+05:30");
  assert.equal(fixed.endTime, "2026-06-21T09:30:00+05:30");
});

test("applyResolvedDate is a no-op when the LLM already got it right", () => {
  const fixed = applyResolvedDate(
    "meet kevin this sunday at 9am",
    "2026-06-21T09:00:00+05:30",
    "2026-06-21T09:30:00+05:30",
    THU
  );
  assert.equal(fixed.startTime, "2026-06-21T09:00:00+05:30");
  assert.equal(fixed.endTime, "2026-06-21T09:30:00+05:30");
});

test("applyResolvedDate is a no-op when no relative phrase is present", () => {
  const fixed = applyResolvedDate(
    "meet kevin on june 30 at 9am",
    "2026-06-30T09:00:00+05:30",
    "2026-06-30T09:30:00+05:30",
    THU
  );
  assert.equal(fixed.startTime, "2026-06-30T09:00:00+05:30");
  assert.equal(fixed.endTime, "2026-06-30T09:30:00+05:30");
});
