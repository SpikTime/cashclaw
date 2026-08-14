import { createHash } from "node:crypto";

export function normalizeText(value = "") { return value.toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}@]+/gu, " ").replace(/\s+/g, " ").trim(); }
export function canonicalUrl(value = "") { try { const url = new URL(value); url.hash = ""; for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key); return url.href.replace(/\/$/, ""); } catch { return ""; } }
const hash = (value) => createHash("sha256").update(value).digest("hex");
const tokens = (value) => new Set(normalizeText(value).split(" ").filter((x) => x.length > 2));
function similarity(a, b) { const aa = tokens(a); const bb = tokens(b); if (!aa.size || !bb.size) return 0; const overlap = [...aa].filter((x) => bb.has(x)).length; return overlap / Math.min(aa.size, bb.size); }
function contact(item) { return (item.contactUsername || `${item.description || ""}`.match(/@([a-zA-Z][\w]{4,31})/)?.[1] || "").toLowerCase(); }
function budget(item) { return Number(item.budget?.min ?? item.budget?.max ?? 0); }
function closeTime(a, b) { if (!a.publishedAt || !b.publishedAt) return true; return Math.abs(new Date(a.publishedAt) - new Date(b.publishedAt)) <= 48 * 3600_000; }

export function opportunityFingerprint(item) { return hash(canonicalUrl(item.externalUrl || "") || normalizeText(item.description || item.title || "")); }
export function deduplicateOpportunities(items) {
  const groups = [];
  for (const item of items) {
    const exactUrl = canonicalUrl(item.externalUrl || "");
    const normalized = normalizeText(item.description || item.title || "");
    const exactHash = hash(normalized);
    const found = groups.find((group) => {
      const base = group.item;
      if (exactUrl && exactUrl === canonicalUrl(base.externalUrl || "")) return true;
      if (exactHash === group.exactHash) return true;
      const sameContact = contact(item) && contact(item) === contact(base);
      const sameBudget = budget(item) && Math.abs(budget(item) - budget(base)) <= Math.max(1000, budget(base) * 0.1);
      return closeTime(item, base) && similarity(normalized, base.description || base.title || "") >= (sameContact && sameBudget ? 0.55 : 0.8);
    });
    const link = { source: item.source, url: item.sourceMessageUrl || item.url || "" };
    if (found) { if (!found.sourceLinks.some((x) => x.source === link.source && x.url === link.url)) found.sourceLinks.push(link); continue; }
    groups.push({ item, exactHash, sourceLinks: [link] });
  }
  return groups.map(({ item, sourceLinks }) => ({ ...item, sourceLinks, sources: [...new Set(sourceLinks.map((x) => x.source))], foundInSources: sourceLinks.length }));
}
