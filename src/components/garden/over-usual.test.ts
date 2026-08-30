/** bun src/components/garden/over-usual.test.ts */
import { strict as assert } from "node:assert";
import { overPercent, overSentence, overPill, overAria } from "./over-usual";

// Genuinely over baseline — the four seeded SOC members on 2026-08-28.
assert.equal(overPercent(4.9), 5);
assert.equal(overPercent(1.1), 1);
assert.equal(overSentence(5.9, false), "Using 6% more power than usual today.");
assert.equal(overSentence(5.9, true), "You're using 6% more power than usual today.");
assert.equal(overPill(3.8), "+4% vs usual");
assert.equal(overAria(true, 3.8), ", using 4% more power than usual");

// Flagged but NOT actually over: earnFor rounds 0.4% under baseline down to 0 points.
// Claiming "using more" here would be a lie, so it must fall to the no-savings branch.
assert.equal(overPercent(-0.4), null);
assert.equal(overPercent(0), null);
assert.equal(overSentence(-0.4, false), "No savings against their usual today.");
assert.equal(overSentence(0, true), "You logged no savings against your usual today.");
assert.equal(overPill(-0.4), "no savings");
assert.equal(overAria(true, -0.4), ", no savings today");

// Not flagged at all — no suffix, whatever the percentage says.
assert.equal(overAria(false, null), "");
assert.equal(overAria(false, 9), "");

console.log("over-usual: all assertions passed");
