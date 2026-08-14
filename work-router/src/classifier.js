import { parseBudget } from "./budget.js";

export const OpportunityType = Object.freeze({ ONE_OFF_PROJECT: "ONE_OFF_PROJECT", SHORT_PROJECT: "SHORT_PROJECT", BOUNTY: "BOUNTY", PART_TIME_CONTRACT: "PART_TIME_CONTRACT", FULL_TIME_JOB: "FULL_TIME_JOB", PARTNERSHIP: "PARTNERSHIP", COFOUNDER: "COFOUNDER", SELF_PROMOTION: "SELF_PROMOTION", SPAM: "SPAM", UNKNOWN: "UNKNOWN" });

const SKILLS = ["telegram mini app", "telegram bot", "ai bot", "automation", "api", "mvp", "react", "next.js", "typescript", "node.js", "nodejs", "python", "fastapi", "aiogram", "postgresql", "parser", "парсер", "llm", "openai", "crm", "web development", "bugfix", "доработк"];
const PROJECT = ["нужно сделать", "нужно разработать", "нужен разработчик", "ищу разработчика", "доработать", "починить", "исправить", "реализовать", "интегрировать", "разовая задача", "looking for developer", "need developer", "need someone", "build", "fix", "implement", "freelance", "project"];
const UNSAFE = ["casino", "казино", "gambling", "mass messaging", "массовая рассылка", "account farming", "fake reviews", "captcha bypass", "credential stealing", "кража данных"];

function includesAny(text, values) { return values.some((value) => text.includes(value)); }
function extractDeadline(text) { return text.match(/(?:до|deadline:?|срок(?:ом)? до)\s*(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/iu)?.[1] || null; }

export function classifyOpportunity(item, now = new Date()) {
  const description = `${item.title || ""} ${item.description || ""}`.trim();
  const text = description.toLowerCase();
  const unsafe = includesAny(text, UNSAFE);
  let classification = OpportunityType.UNKNOWN;
  if (unsafe || /(?:спам|spam)\b/iu.test(text)) classification = OpportunityType.SPAM;
  else if (/ищу работу|мо[её] резюме|предлагаю услуги|available for work|my cv/iu.test(text)) classification = OpportunityType.SELF_PROMOTION;
  else if (/co[- ]?founder|кофаундер|соосновател/iu.test(text)) classification = OpportunityType.COFOUNDER;
  else if (/партн[её]р|partnership/iu.test(text)) classification = OpportunityType.PARTNERSHIP;
  else if (/bounty|награда за issue/iu.test(text) || item.acquisitionModel === "bounty") classification = OpportunityType.BOUNTY;
  else if (/part[- ]?time|частичн(?:ая|ой) занятост|contractor/iu.test(text)) classification = OpportunityType.PART_TIME_CONTRACT;
  else if (/full[- ]?time|fulltime|полная занятость|5\s*\/\s*2|в штат|постоянн(?:ая|ую) работ|salary per month|зарплат|оклад|трудоустройств|оформление (?:по )?тк|график по мск|employment|\bвакансия\b/iu.test(text)) classification = OpportunityType.FULL_TIME_JOB;
  else if (/срочно|на (?:день|недел)|коротк(?:ий|ая) проект/iu.test(text) && includesAny(text, PROJECT)) classification = OpportunityType.SHORT_PROJECT;
  else if (includesAny(text, PROJECT) || /(?:создать|разработать|сделать|спарсить|парсинг|парсер|нужен|нужно|оплата|проект)/iu.test(text)) classification = OpportunityType.ONE_OFF_PROJECT;
  const techStack = [...new Set(SKILLS.filter((skill) => text.includes(skill)).map((skill) => skill.replace("доработк", "доработка")))];
  const skillMatch = Math.min(100, techStack.length * 25 + (/(telegram mini app|telegram bot|automation|api)/iu.test(text) ? 35 : 0));
  const budget = parseBudget(description);
  const contactUsername = description.match(/(?:^|\s)@([a-zA-Z][\w]{4,31})\b/)?.[1] || null;
  const publishedAt = item.publishedAt || null;
  const ageMinutes = publishedAt ? Math.max(0, Math.round((now - new Date(publishedAt)) / 60000)) : null;
  const freshnessScore = ageMinutes == null ? 40 : ageMinutes < 30 ? 100 : ageMinutes < 120 ? 85 : ageMinutes < 720 ? 65 : ageMinutes < 2880 ? 35 : 10;
  const typeScore = { ONE_OFF_PROJECT: 85, SHORT_PROJECT: 90, BOUNTY: 75, PART_TIME_CONTRACT: 55, FULL_TIME_JOB: 20, PARTNERSHIP: 20, COFOUNDER: 5, SELF_PROMOTION: 0, SPAM: 0, UNKNOWN: 15 }[classification];
  const preliminaryScore = Math.max(0, Math.min(100, Math.round(typeScore * 0.45 + skillMatch * 0.35 + freshnessScore * 0.1 + (budget ? 10 : 0))));
  return { ...item, description, classification, budget, budgetConfidence: budget?.confidence || "none", contactUsername, contactUrl: contactUsername ? `https://t.me/${contactUsername}` : null, deadline: extractDeadline(description), techStack, projectType: classification, publishedAt, ageMinutes, freshnessScore, skillMatch, preliminaryScore, proposalCost: 0, rejected: unsafe || [OpportunityType.SELF_PROMOTION, OpportunityType.SPAM].includes(classification), rejectionReason: unsafe ? "unsafe_or_prohibited" : classification === OpportunityType.SELF_PROMOTION ? "self_promotion" : classification === OpportunityType.SPAM ? "spam" : null };
}
