import { loadConfig } from "../src/config.js";
import { fetchPublicProjects } from "../src/kwork.js";
import { fetchPublicMarketplaces } from "../src/public-marketplaces.js";
import { fetchGitHubBounties } from "../src/github-source.js";

const config = loadConfig();
const checks = [
  ["Kwork", () => fetchPublicProjects(config.source)],
  ["Freelance.ru + FL.ru", () => fetchPublicMarketplaces(config.source)],
  ["GitHub Bounties", () => fetchGitHubBounties(config.github.token)],
];
for (const [name, run] of checks) {
  try { console.log(`${name}: ${(await run()).length}`); }
  catch (error) { console.log(`${name}: ERROR ${error.message}`); }
}
