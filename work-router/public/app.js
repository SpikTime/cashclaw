const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const $ = (id) => document.getElementById(id);
let timer;
const labels = { queued: "В очереди", analyzing: "Claude анализирует", ready: "Готово", error: "Ошибка", manual_review: "Нужна ручная проверка", skip: "Пропущено" };
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "—";
const safeUrl = (value) => /^https:\/\//i.test(value || "") ? value : "";
function bountyDetails(job) {
  if (!job.bounty || !job.rewardTrust) return "";
  const trust = job.rewardTrust;
  const rows = [["Заявленная награда", money(trust.advertisedReward)], ["Ожидаемая награда", money(trust.effectiveExpectedReward)], ["Лимит доверенной награды", money(trust.trustedRewardCap)], ["Статус финансирования", job.bounty.fundingStatus || "unknown"], ["Доверие к награде", `${trust.rewardTrustScore}/100`], ["Вероятность оплаты", `${Math.round((trust.paymentProbability || 0) * 100)}%`], ["Конкуренция", String(job.bounty.solverCount ?? "—")], ["Аномалия", trust.anomaly?.level || "normal"], ["Осуществимость", job.feasibility ? `${job.feasibility.overallFeasibilityScore}/100` : "—"], ["Ожидаемая прибыль", money(job.economics?.riskAdjustedNetProfit)]];
  return `<dl class="bounty">${rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}
function card(job) {
  const progress = ["queued", "analyzing"].includes(job.status) ? '<div class="progress" aria-label="Анализ выполняется"><i></i></div>' : "";
  const risks = job.risks?.length ? `<ul class="risks">${job.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>` : "";
  const result = job.status === "ready" ? `<div class="score">${Number(job.score)}/100</div><p class="body">${escapeHtml(job.summary)}</p>${risks}${job.proposalDraft ? `<div class="proposal"><strong>Черновик отклика</strong><br>${escapeHtml(job.proposalDraft)}</div>` : ""}` : job.status === "error" ? `<p class="body">${escapeHtml(job.error)}</p>` : "";
  const url = safeUrl(job.url);
  const source = job.source ? `<p class="meta">${escapeHtml(job.source)} · ${escapeHtml(job.acquisitionModel || "")}${url ? ` · <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Открыть</a>` : ""}</p>` : "";
  return `<article class="card"><div class="card-top"><h3 class="title">${escapeHtml(job.title)}</h3><span class="badge ${escapeHtml(job.status)}">${labels[job.status] || escapeHtml(job.status)}</span></div>${source}${progress}${bountyDetails(job)}${result}</article>`;
}
async function load() { try { $("refresh").disabled = true; const response = await fetch("/api/jobs", { headers: { "X-Telegram-Init-Data": tg?.initData || "" } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Ошибка загрузки"); const jobs = data.jobs || []; $("jobs").innerHTML = jobs.length ? jobs.map(card).join("") : '<div class="empty">Новые возможности появятся здесь после проверки источников.</div>'; $("total").textContent = jobs.length; $("active").textContent = jobs.filter((job) => ["queued", "analyzing"].includes(job.status)).length; const scores = jobs.map((job) => job.score).filter(Number.isFinite); $("best").textContent = scores.length ? Math.max(...scores) : "—"; $("error").hidden = true; $("connection").innerHTML = "<i></i> Обновлено"; } catch (error) { $("error").textContent = error.message; $("error").hidden = false; $("connection").textContent = "Нет связи"; } finally { $("refresh").disabled = false; } }
$("refresh").addEventListener("click", load); load(); timer = setInterval(load, 3000);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearInterval(timer); else { load(); timer = setInterval(load, 3000); } });
