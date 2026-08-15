import fs from "node:fs";
const file = ".agents/skills/bounty-trust-analysis/SKILL.md";
const text = fs.readFileSync(file, "utf8");
if (!text.startsWith("---\n") || !/name: bounty-trust-analysis/.test(text) || !/description:/.test(text)) throw new Error("Invalid bounty trust skill metadata.");
console.log("Bounty trust skill metadata is valid.");
