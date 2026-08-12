import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { summarizeBountyMoney } from "./store.js";

export function validateTelegramInitData(initData, token, allowedUsers, maxAgeSeconds = 86400) {
  if (!initData) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return false;
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (hash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) return false;
  try { return allowedUsers.has(String(JSON.parse(params.get("user") || "{}").id)); }
  catch { return false; }
}

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}

export function startWebServer(config, store, root = process.cwd()) {
  const publicDir = path.join(root, "public");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/jobs") {
      if (!validateTelegramInitData(req.headers["x-telegram-init-data"] || "", config.telegram.token, config.telegram.allowedUsers)) {
        return send(res, 401, "application/json; charset=utf-8", JSON.stringify({ error: "Откройте приложение через Telegram" }));
      }
      const jobs = store.state.jobs.map(({ id, title, source, url, acquisitionModel, bounty, rewardTrust, feasibility, economics, fastLane, moneyStatus, status, score, summary, risks, proposalDraft, error, createdAt, updatedAt }) => ({ id, title, source, url, acquisitionModel, bounty, rewardTrust, feasibility, economics, fastLane, moneyStatus, status, score, summary, risks, proposalDraft, error, createdAt, updatedAt }));
      return send(res, 200, "application/json; charset=utf-8", JSON.stringify({ jobs, bountyAnalytics: summarizeBountyMoney(jobs) }));
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!/^(index\.html|app\.css|app\.js)$/.test(file)) return send(res, 404, "text/plain; charset=utf-8", "Not found");
    const type = file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
    try { return send(res, 200, type, fs.readFileSync(path.join(publicDir, file))); }
    catch { return send(res, 404, "text/plain; charset=utf-8", "Not found"); }
  });
  server.listen(config.app.port, config.app.host, () => console.log(`Mini App: http://${config.app.host}:${config.app.port}`));
  return server;
}
