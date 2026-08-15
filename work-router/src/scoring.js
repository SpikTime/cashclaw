export const Eligibility = Object.freeze({ ELIGIBLE: "ELIGIBLE", LOW_PRIORITY: "LOW_PRIORITY", SUPPRESSED: "SUPPRESSED", MANUAL_REVIEW: "MANUAL_REVIEW" });

const TYPE_SCORE = { BOUNTY: 25, ONE_OFF_PROJECT: 25, SHORT_PROJECT: 23, PART_TIME_CONTRACT: 12, PARTNERSHIP: 4, COFOUNDER: 2, FULL_TIME_JOB: 0, SELF_PROMOTION: 0, SPAM: 0, UNKNOWN: 6 };
const DIRECT_SKILLS = /telegram\s*(?:mini app|bot)|aiogram|fastapi|next\.?js|react|typescript|javascript|node\.?js|python|postgres|api|парс|scrap|automation|автоматизац|интеграц|dashboard|crm|llm|openai|веб[- ]?прилож/iu;
const VIBE_TASKS = /telegram\s*(?:mini app|bot)|crud|api|парс|scrap|admin|админ|dashboard|landing|saas|automation|автоматизац|интеграц|обработк[аи] данных|отчетност/iu;
const LEAD_ROLE = /\b(?:tech\s*lead|team\s*lead|lead\s+(?:developer|engineer)|head\s+of|engineering\s+manager|руководител[ья]|техлид)\b/iu;
const SENIOR_ONLY = /\b(?:senior|principal|staff)\b|\b(?:старший|ведущий)\s+(?:разработчик|инженер)/iu;
const UNPAID = /без\s+оплат|оплаты\s+нет|unpaid|за\s+идею/iu;
const EQUITY_ONLY = /только\s+дол|equity\s+only|доля\s+в\s+проекте/iu;
const VAGUE = /(?:есть работа|подробности в лич|пишите в лс|details in dm)/iu;

function mismatchReason(text) {
  if (/\b1[сc]\b|java\s+enterprise|c#\s+enterprise|\.net\s+enterprise|php\s*\/\s*go|php.*yii|go[- ]only|native\s+(?:ios|android)|swift\s+developer|kotlin\s+developer/iu.test(text)) return "skill_domain_mismatch";
  if (/\bseo\b|копирайт|стать[ьи]|3d\s*(?:model|anim)|моделирован|графическ(?:ий|ого)\s+дизайн|логотип|фирменн(?:ый|ого)\s+стиль/iu.test(text) && !DIRECT_SKILLS.test(text)) return "skill_domain_mismatch";
  return null;
}

export function determineEligibility(item) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  if (item.rejected || ["SPAM", "SELF_PROMOTION"].includes(item.classification)) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: item.rejectionReason || "spam_or_self_promotion" };
  if (text.length > 1200 && /(?:давайте разбер|рекомендации для|итог:|conclusion:|a guide to)/iu.test(text)) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: "non_opportunity_content" };
  if (item.acquisitionModel === "bounty" && item.rewardTrust?.manualReview) return { eligibility: Eligibility.MANUAL_REVIEW, suppressedReason: null };
  if (item.classification === "FULL_TIME_JOB" && !item.allowFullTime) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: "full_time_job" };
  if (LEAD_ROLE.test(text)) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: "seniority_mismatch" };
  if (SENIOR_ONLY.test(text)) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: "seniority_mismatch" };
  const domainMismatch = mismatchReason(text); if (domainMismatch) return { eligibility: Eligibility.SUPPRESSED, suppressedReason: domainMismatch };
  if (["PART_TIME_CONTRACT", "UNKNOWN", "PARTNERSHIP", "COFOUNDER"].includes(item.classification)) return { eligibility: Eligibility.LOW_PRIORITY, suppressedReason: null };
  return { eligibility: Eligibility.ELIGIBLE, suppressedReason: null };
}

function skillFit(item, text) {
  if (mismatchReason(text)) return 0;
  let value = Math.round(Number(item.skillMatch || 0) / 5);
  if (/telegram\s*(?:mini app|bot)/iu.test(text) && /api|crm|python|aiogram|react|typescript/iu.test(text)) value = 20;
  else if (/парс|scrap|fastapi|automation|автоматизац|dashboard|crm.*интеграц|интеграц.*crm/iu.test(text)) value = Math.max(value, 18);
  else if (DIRECT_SKILLS.test(text)) value = Math.max(value, 14);
  return Math.min(20, value);
}

function monetary(item, text) {
  if (UNPAID.test(text) || EQUITY_ONLY.test(text)) return 0;
  const budget = item.budget; if (!budget || budget.min == null && budget.max == null) return 6;
  const amount = Number(budget.max ?? budget.min ?? 0);
  if (["USD", "USDT", "EUR"].includes(budget.currency)) return amount >= 1500 ? 15 : amount >= 700 ? 13 : amount >= 300 ? 10 : 7;
  return amount >= 100000 ? 15 : amount >= 50000 ? 13 : amount >= 20000 ? 10 : amount >= 5000 ? 7 : 4;
}

function vibeCoding(text) { if (mismatchReason(text)) return 1; if (VIBE_TASKS.test(text)) return 15; if (/react|next\.?js|fastapi|python|typescript|node\.?js|web|сайт|mvp/iu.test(text)) return 12; return 5; }
function winProbability(item, text) { if (LEAD_ROLE.test(text) || SENIOR_ONLY.test(text) || /\d+\+?\s*(?:years|лет)\s+(?:experience|опыта)|сертификат/iu.test(text)) return 1; if (["ONE_OFF_PROJECT", "SHORT_PROJECT", "BOUNTY"].includes(item.classification)) return 9; if (item.classification === "PART_TIME_CONTRACT") return 6; if (item.classification === "FULL_TIME_JOB") return 2; return 3; }
function freshness(item) { const age = item.ageMinutes; return age == null ? 5 : age < 30 ? 10 : age < 120 ? 9 : age < 720 ? 7 : age < 2880 ? 4 : 1; }
function clarity(item, text) { if (VAGUE.test(text) || text.length < 35) return 0; let value = 0; if (/нужно|создать|сделать|разработать|доработать|исправить|реализовать|build|fix|implement/iu.test(text)) value += 1; if (item.budget) value += 1; if (item.deadline || /срок|deadline|недел|дн(?:я|ей)|час/iu.test(text)) value += 1; if (item.contactUsername || /контакт|заказчик|company|компания/iu.test(text)) value += 1; if (DIRECT_SKILLS.test(text) || /результат|deliverable|по figma/iu.test(text)) value += 1; return Math.min(5, value); }

function riskPenalties(item, text, eligibility) {
  let penalties = 0; const reasons = [];
  const rolePenalty = LEAD_ROLE.test(text) ? -40 : item.classification === "FULL_TIME_JOB" ? -35 : SENIOR_ONLY.test(text) ? -30 : 0;
  if (rolePenalty) { penalties += rolePenalty; reasons.push(rolePenalty === -40 ? "lead role" : rolePenalty === -35 ? "full-time employment" : "senior-only role"); }
  if (mismatchReason(text)) { penalties -= 25; reasons.push("skill domain mismatch"); }
  if (UNPAID.test(text)) { penalties -= 30; reasons.push("unpaid"); } else if (EQUITY_ONLY.test(text)) { penalties -= 25; reasons.push("equity only"); }
  if (item.classification === "SPAM" || item.rejectionReason === "spam") { penalties -= 20; reasons.push("spam signals"); }
  if (clarity(item, text) === 0) { penalties -= 10; reasons.push("unclear description"); }
  if (eligibility === Eligibility.MANUAL_REVIEW) reasons.push("manual reward verification required");
  return { penalties, reasons };
}

export function scoreOpportunity(item) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  const { eligibility, suppressedReason } = determineEligibility(item);
  const components = { projectType: TYPE_SCORE[item.classification] ?? 0, skillFit: skillFit(item, text), monetary: monetary(item, text), vibeCoding: vibeCoding(text), winProbability: winProbability(item, text), freshness: freshness(item), clarity: clarity(item, text) };
  const risk = riskPenalties(item, text, eligibility);
  const scoreBreakdown = { ...components, penalties: risk.penalties };
  const score = Math.max(0, Math.min(100, Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)));
  const scoreReasons = [];
  if (components.projectType >= 23) scoreReasons.push("one-off or short paid project"); else if (components.projectType >= 12) scoreReasons.push("lower-priority contract type");
  if (components.skillFit >= 18) scoreReasons.push("strong operator skill match"); else if (components.skillFit >= 12) scoreReasons.push("adjacent achievable skill match");
  if (components.vibeCoding >= 13) scoreReasons.push("high AI-assisted implementation suitability");
  if (components.monetary >= 10) scoreReasons.push("useful stated budget"); else if (!item.budget) scoreReasons.push("budget not stated");
  if (components.clarity >= 4) scoreReasons.push("clear scope and delivery signals");
  scoreReasons.push(...risk.reasons);
  return { ...item, score, preliminaryScore: score, scoreBreakdown, eligibility, suppressedReason, scoreReasons, scoringVersion: 5 };
}

export function distributionStats(values) {
  const sorted = [...values].sort((a, b) => a - b); const pick = (p) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0; const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length); const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, sorted.length);
  return { min: sorted[0] ?? 0, max: sorted.at(-1) ?? 0, median: pick(0.5), p25: pick(0.25), p75: pick(0.75), standardDeviation: Number(Math.sqrt(variance).toFixed(2)) };
}
