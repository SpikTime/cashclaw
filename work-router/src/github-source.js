function findRewardAmount(text = "") {
  const match = text.match(/(?:\$|usd\s*)(\d[\d,]*(?:\.\d{1,2})?)/i);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

function findProvider(text = "") {
  if (/opire/i.test(text)) return "opire";
  if (/algora/i.test(text)) return "algora";
  if (/issuehunt/i.test(text)) return "issuehunt";
  return "github";
}

export function mapGitHubIssues(items) {
  return items.filter((item) => !item.pull_request).map((item) => ({
    source: "github-bounties",
    sourceId: "github-bounties",
    acquisitionModel: "bounty",
    title: item.title,
    description: `${item.title}\n${item.body || ""}\nLabels: ${(item.labels || []).map((label) => typeof label === "string" ? label : label.name).join(", ")}`.slice(0, 10_000),
    url: item.html_url,
    bounty: {
      provider: findProvider(`${item.title}\n${item.body || ""}`),
      advertisedAmount: findRewardAmount(`${item.title}\n${item.body || ""}`),
      currency: "USD",
      fundingStatus: "unknown",
      paymentGuaranteed: false,
      rewardCount: 0,
      contributors: [],
      solverCount: 0,
      claimRequired: false,
      paymentHistoryAvailable: false,
      issueCreatedAt: item.created_at,
      lastActivityAt: item.updated_at,
      repositoryQuality: item.repository_url ? "unknown" : "suspicious",
    },
  }));
}

export async function fetchGitHubBounties(token = "") {
  const query = 'is:issue is:open (label:bounty OR label:reward OR label:paid OR label:"paid issue" OR label:"cash bounty")';
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", query);
  url.searchParams.set("advanced_search", "true");
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "30");
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "CashClaw-Work-Router" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`GitHub search failed: ${response.status}`);
  return mapGitHubIssues((await response.json()).items || []);
}
