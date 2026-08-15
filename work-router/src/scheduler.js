function rank(item) { return Number(item.preliminaryScore || 0) * 4 + Number(item.freshnessScore || 0) * 1.2 + Number(item.sourceQualityScore || 50) + (item.budget ? 20 : 0) + Number(item.skillMatch || 0) * 1.5; }
export function allocateDeepSlots(candidates, limit = 12) {
  if (limit <= 0) return [];
  const sorted = [...candidates].sort((a, b) => rank(b) - rank(a));
  const groups = new Map();
  for (const item of sorted) { if (!groups.has(item.source)) groups.set(item.source, []); groups.get(item.source).push(item); }
  const selected = [];
  for (const items of groups.values()) { if (selected.length >= limit) break; selected.push(items.shift()); }
  const remaining = [...groups.values()].flat().sort((a, b) => rank(b) - rank(a));
  selected.push(...remaining.slice(0, Math.max(0, limit - selected.length)));
  return selected;
}
