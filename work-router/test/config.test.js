import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/config.js";

test("parseEnv ignores comments and preserves values containing equals", () => {
  assert.deepEqual(parseEnv("# x\nTOKEN=a=b\nEMPTY=\n"), { TOKEN: "a=b", EMPTY: "" });
});
