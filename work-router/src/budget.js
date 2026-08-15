const CURRENCY = /(USDT|USD|EUR|руб(?:лей|ля|ль)?|₽|\$|€)/iu;
const MULTIPLIER = /(тыс(?:яч[аи]?)?|[кk])/iu;

function amount(value, multiplier = "") {
  const number = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * (MULTIPLIER.test(multiplier) ? 1000 : 1)) : null;
}

function currency(raw) {
  if (/USDT/i.test(raw)) return "USDT";
  if (/USD|\$/i.test(raw)) return "USD";
  if (/EUR|€/i.test(raw)) return "EUR";
  return "RUB";
}

export function parseBudget(text = "") {
  if (/по\s+договор[её]нности|negotiable|обсуждается/iu.test(text)) return { min: null, max: null, currency: null, confidence: "low", raw: text.match(/по\s+договор[её]нности|negotiable|обсуждается/iu)?.[0] || "" };
  const prefixed = text.match(/(\$|€)\s*((?:\d[\d ]*)(?:[.,]\d+)?)\s*[-–—]\s*(?:\$|€)?\s*((?:\d[\d ]*)(?:[.,]\d+)?)/u);
  if (prefixed) return { min: amount(prefixed[2]), max: amount(prefixed[3]), currency: currency(prefixed[1]), confidence: "high", raw: prefixed[0].replace(/\s/g, "") };
  const range = text.match(new RegExp(`((?:\\d[\\d ]*)(?:[.,]\\d+)?)\\s*(тыс(?:яч[аи]?)?|[кk])?\\s*[-–—]\\s*((?:\\d[\\d ]*)(?:[.,]\\d+)?)\\s*(тыс(?:яч[аи]?)?|[кk])?\\s*(${CURRENCY.source})?`, "iu"));
  if (range) {
    const sharedMultiplier = range[4] || range[2] || "";
    const raw = range[0].trim();
    return { min: amount(range[1], range[2] || sharedMultiplier), max: amount(range[3], range[4] || sharedMultiplier), currency: currency(raw), confidence: "high", raw };
  }
  const single = text.match(new RegExp(`(от|до)?\\s*((?:\\d[\\d ]*)(?:[.,]\\d+)?)\\s*(тыс(?:яч[аи]?)?|[кk])?\\s*(${CURRENCY.source})`, "iu")) || text.match(/(от|до)?\s*((?:\d[\d ]*)(?:[.,]\d+)?)\s*(тыс(?:яч[аи]?)?|[кk])/iu);
  if (!single) return null;
  const raw = single[0].trim();
  const value = amount(single[2], single[3]);
  return { min: /^до$/iu.test(single[1] || "") ? null : value, max: /^до$/iu.test(single[1] || "") ? value : /^от$/iu.test(single[1] || "") ? null : value, currency: currency(raw), confidence: "high", raw };
}
