import test from "node:test";
import assert from "node:assert/strict";
import { isWithinActiveHours } from "../src/schedule.js";

const schedule = { start: "09:00", end: "23:00", timeZone: "Asia/Yekaterinburg" };

test("active schedule runs during the day and pauses at night", () => {
  assert.equal(isWithinActiveHours(schedule, new Date("2026-08-05T07:00:00Z")), true);
  assert.equal(isWithinActiveHours(schedule, new Date("2026-08-05T20:30:00Z")), false);
});
