const api = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export async function getUpdates(config, offset) {
  const url = new URL(api(config.token, "getUpdates"));
  url.searchParams.set("timeout", "20");
  if (offset) url.searchParams.set("offset", String(offset));
  const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`Telegram getUpdates failed: ${response.status}`);
  const body = await response.json();
  return body.result || [];
}

export async function sendMessage(config, chatId, text) {
  const response = await fetch(api(config.token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`);
}

export function isAllowed(config, message) {
  return config.allowedUsers.has(String(message.from?.id)) && config.allowedChats.has(String(message.chat?.id));
}

export function formatAnalysis(item, analysis) {
  const risks = analysis.risks?.length ? analysis.risks.map((x) => `• ${x}`).join("\n") : "• Явных рисков не найдено";
  return `Оценка: ${analysis.score}/100\n\n${analysis.summary}\n\nРиски:\n${risks}\n\nЧерновик отклика:\n${analysis.proposalDraft || "Не подготовлен"}${item.url ? `\n\n${item.url}` : ""}`;
}
