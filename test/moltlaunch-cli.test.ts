import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMltlInvocation } from "../src/moltlaunch/cli.js";

describe("resolveMltlInvocation", () => {
  it("runs the npm-installed JavaScript entry through Node on Windows", () => {
    const appData = "C:\\Users\\Test\\AppData\\Roaming";
    const expectedEntry = path.win32.join(
      appData,
      "npm",
      "node_modules",
      "moltlaunch",
      "dist",
      "index.js",
    );

    expect(resolveMltlInvocation({
      platform: "win32",
      appData,
      nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
      fileExists: (candidate) => candidate === expectedEntry,
    })).toEqual({
      executable: "C:\\Program Files\\nodejs\\node.exe",
      prefixArgs: [expectedEntry],
    });
  });

  it("uses the portable executable name outside Windows", () => {
    expect(resolveMltlInvocation({
      platform: "linux",
      nodeExecutable: "/usr/bin/node",
      fileExists: () => false,
    })).toEqual({ executable: "mltl", prefixArgs: [] });
  });
});
