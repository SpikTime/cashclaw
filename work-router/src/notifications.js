const TARGET_TYPES = new Set(["ONE_OFF_PROJECT", "SHORT_PROJECT", "BOUNTY", "PART_TIME_CONTRACT"]);
export function notificationBand(score, thresholds = {}) { const hot = Number(thresholds.hot ?? 70); const good = Number(thresholds.good ?? 55); const maybe = Number(thresholds.maybe ?? 45); return score >= hot ? "HOT" : score >= good ? "GOOD" : score >= maybe ? "MAYBE" : "SILENT"; }
function details(item) { const sources = item.foundInSources > 1 ? `\nНайдено в ${item.foundInSources} источниках` : ""; const budget = item.budget ? `\nБюджет: ${item.budget.raw || `${item.budget.min || "?"}-${item.budget.max || "?"} ${item.budget.currency || ""}`}` : ""; const url = item.sourceMessageUrl || item.url; return `${item.title || item.description || "Возможность"}${budget}${sources}${url ? `\n${url}` : ""}`; }
function target(item) { return !item.classification || TARGET_TYPES.has(item.classification); }
export function createNotifications(items, chatId, thresholds = {}) {
  const notices = []; const maybe = [];
  for (const item of items) {
    const interestingBounty = Number(item.rewardTrust?.advertisedReward || 0) >= 50 || Number(item.feasibility?.overallFeasibilityScore || 0) >= 80;
    if (item.acquisitionModel === "bounty" && item.rewardTrust?.manualReview) { if (interestingBounty) notices.push({ opportunityId: item.id, kind: "bounty_review", chatId, text: `⚠️ BOUNTY — MANUAL REVIEW\n${details(item)}` }); continue; }
    if (!target(item)) continue;
    if (Number(item.ageMinutes) < 60 && Number(item.proposalCost) === 0 && Number(item.skillMatch) >= 80 && Number(item.preliminaryScore) >= 75) notices.push({ opportunityId: item.id, kind: "fast", chatId, text: `⚡ СВЕЖИЙ ЗАКАЗ\nPreliminary analysis\n${details(item)}` });
    if (!Number.isFinite(item.score)) continue;
    const band = notificationBand(item.score, thresholds);
    if (band === "HOT") notices.push({ opportunityId: item.id, kind: "hot", chatId, text: `🔥 СИЛЬНАЯ ВОЗМОЖНОСТЬ — ${item.score}/100\n${details(item)}` });
    else if (band === "GOOD") notices.push({ opportunityId: item.id, kind: "good", chatId, text: `✅ ПОДХОДИТ — ${item.score}/100\n${details(item)}` });
    else if (band === "MAYBE") maybe.push(item);
  }
  if (maybe.length) notices.push({ opportunityId: `digest:${maybe.map((x) => x.id).sort().join(",")}`, kind: "maybe_digest", chatId, text: `${maybe.length} возможных задач\n${maybe.map((x) => `• ${x.title || x.description} (${x.score}/100)`).join("\n")}` });
  return notices;
}
