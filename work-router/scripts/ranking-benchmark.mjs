import { classifyOpportunity } from "../src/classifier.js";
import { distributionStats, scoreOpportunity } from "../src/scoring.js";
import { rankingFixture } from "../test/fixtures/ranking.js";

const now = new Date("2026-08-15T10:00:00Z");
const results = rankingFixture.map((fixture) => scoreOpportunity(classifyOpportunity({
  id: fixture.id,
  source: "benchmark",
  title: fixture.text,
  description: fixture.text,
  publishedAt: "2026-08-15T09:30:00Z",
}, now))).sort((a, b) => b.score - a.score);

console.log("Distribution", distributionStats(results.map((item) => item.score)));
console.log("\nTop 5");
console.table(results.slice(0, 5).map(({ id, score, eligibility, classification }) => ({ id, score, eligibility, classification })));
console.log("\nBottom 5");
console.table(results.slice(-5).map(({ id, score, eligibility, suppressedReason }) => ({ id, score, eligibility, suppressedReason })));
console.log("\nRequired breakdowns");
for (const id of ["crm-bot", "market-parser", "python-fulltime", "senior-frontend", "tech-lead"]) {
  const item = results.find((candidate) => candidate.id === id);
  console.log(id, { score: item.score, eligibility: item.eligibility, suppressedReason: item.suppressedReason, scoreBreakdown: item.scoreBreakdown, scoreReasons: item.scoreReasons });
}
