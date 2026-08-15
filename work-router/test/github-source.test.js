import test from "node:test";
import assert from "node:assert/strict";
import { mapGitHubIssues } from "../src/github-source.js";

test("mapGitHubIssues keeps paid issues and excludes pull requests", () => {
  const result = mapGitHubIssues([
    { title: "Fix API", body: "Reward $100", html_url: "https://github.com/a/b/issues/1", labels: [{ name: "bounty" }], created_at: "2026-08-10", updated_at: "2026-08-11", repository_url: "https://api.github.com/repos/a/b" },
    { title: "PR", html_url: "https://github.com/a/b/pull/2", labels: [], pull_request: {} },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].source, "github-bounties");
  assert.equal(result[0].acquisitionModel, "bounty");
  assert.equal(result[0].bounty.advertisedAmount, 100);
  assert.match(result[0].description, /Reward \$100/);
});
