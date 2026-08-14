import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateTelegramInitData, createWebHandler } from "../src/web.js";
import { createStore } from "../src/store.js";

function signed(token, userId = 42) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "q", user: JSON.stringify({ id: userId }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

test("validateTelegramInitData accepts a signed allowed user and rejects tampering", () => {
  const token = "123:test";
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "q", user: JSON.stringify({ id: 42 }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
  assert.equal(validateTelegramInitData(params.toString(), token, new Set(["42"])), true);
  params.set("user", JSON.stringify({ id: 7 }));
  assert.equal(validateTelegramInitData(params.toString(), token, new Set(["42"])), false);
});

test("source API is authenticated, validates usernames, and never exposes tokens", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-web-"));
  const store = createStore(root, { direct: true });
  const config = { telegram: { token: "123:test", allowedUsers: new Set(["42"]) } };
  const server = http.createServer(createWebHandler(config, store, {}, path.resolve("."))).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve)); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/sources`)).status, 401);
  const response = await fetch(`${base}/api/sources`, { method: "POST", headers: { "X-Telegram-Init-Data": signed(config.telegram.token), "Content-Type": "application/json" }, body: JSON.stringify({ username: "@new_jobs" }) });
  assert.equal(response.status, 201);
  const body = await response.text();
  assert.match(body, /new_jobs/);
  assert.doesNotMatch(body, /123:test/);
});
