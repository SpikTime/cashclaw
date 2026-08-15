import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { summarizeBountyMoney } from "./store.js";
import { addTelegramSource, ensureSourceRegistry, normalizeTelegramUsername } from "./source-registry.js";

export function validateTelegramInitData(initData, token, allowedUsers, maxAgeSeconds = 86400) { if (!initData) return false; const params = new URLSearchParams(initData); const hash = params.get("hash"); if (!hash) return false; params.delete("hash"); const authDate = Number(params.get("auth_date")); if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return false; const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n"); const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest(); const expected = crypto.createHmac("sha256", secret).update(check).digest("hex"); if (hash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) return false; try { return allowedUsers.has(String(JSON.parse(params.get("user") || "{}").id)); } catch { return false; } }
function send(res, status, type, body) { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; connect-src 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org" }); res.end(body); }
const json = (res, status, value) => send(res, status, "application/json; charset=utf-8", JSON.stringify(value));
async function readJson(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 16_384) throw Object.assign(new Error("Request too large"), { status: 413 }); chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); } }

export function createWebHandler(config, store, actions = {}, root = process.cwd()) {
  const publicDir = path.join(root, "public"); const requests = [];
  return async (req, res) => {
    try {
      const now = Date.now(); while (requests[0] < now - 60_000) requests.shift(); if (requests.length >= 180) return json(res, 429, { error: "Слишком много запросов" }); requests.push(now);
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (!validateTelegramInitData(req.headers["x-telegram-init-data"] || "", config.telegram.token, config.telegram.allowedUsers)) return json(res, 401, { error: "Откройте приложение через Telegram" });
        ensureSourceRegistry(store);
        if (req.method === "GET" && url.pathname === "/api/jobs") { const jobs = [...store.state.opportunities, ...store.state.jobs].slice(0, 1000); return json(res, 200, { jobs, bountyAnalytics: summarizeBountyMoney(jobs), latestCycle: store.state.cycles[0] || null }); }
        if (req.method === "GET" && url.pathname === "/api/sources") return json(res, 200, { sources: store.state.sources, latestCycle: store.state.cycles[0] || null });
        if (req.method === "GET" && url.pathname === "/api/cycles") return json(res, 200, { cycles: store.state.cycles.slice(0, 100) });
        if (req.method === "POST" && url.pathname === "/api/sources") return json(res, 201, { source: addTelegramSource(store, await readJson(req)) });
        const action = url.pathname.match(/^\/api\/sources\/([a-zA-Z][\w]{4,31})\/(enable|disable|test|run)$/);
        if (req.method === "POST" && action) { const username = normalizeTelegramUsername(action[1]); const source = store.state.sources.find((item) => item.username === username); if (!source) return json(res, 404, { error: "Источник не найден" }); if (action[2] === "enable" || action[2] === "disable") { source.enabled = action[2] === "enable"; store.save(); return json(res, 200, { source }); } if (action[2] === "test") return json(res, 200, { result: await actions.testSource?.(username) }); return json(res, 202, { result: await actions.runCycle?.() }); }
        return json(res, 404, { error: "Not found" });
      }
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1); if (!/^(index\.html|app\.css|app\.js)$/.test(file)) return send(res, 404, "text/plain; charset=utf-8", "Not found"); const type = file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8"; try { return send(res, 200, type, fs.readFileSync(path.join(publicDir, file))); } catch { return send(res, 404, "text/plain; charset=utf-8", "Not found"); }
    } catch (error) { return json(res, Number(error.status || 500), { error: Number(error.status) < 500 ? error.message : "Временная ошибка сервера" }); }
  };
}
export function startWebServer(config, store, actions = {}, root = process.cwd()) { const server = http.createServer(createWebHandler(config, store, actions, root)); server.listen(config.app.port, config.app.host, () => console.log(JSON.stringify({ event: "mini_app_started", host: config.app.host, port: config.app.port }))); return server; }
