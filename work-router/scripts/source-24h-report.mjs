import fs from "node:fs";
import path from "node:path";
import { createStore } from "../src/store.js";
import { generateSourceReport } from "../src/report.js";
const store=createStore();const target=path.join(process.cwd(),"docs","SOURCE_24H_REPORT.md");fs.writeFileSync(target,generateSourceReport(store.state),"utf8");console.log(`Wrote ${target}`);
