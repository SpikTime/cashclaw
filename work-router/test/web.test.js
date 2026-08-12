import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateTelegramInitData } from "../src/web.js";

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
