import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicProjects, prefilterProjects } from "../src/kwork.js";

test("parsePublicProjects extracts and deduplicates public links", () => {
  const html = '<a href="/projects/123/test"><b>Сделать сайт</b></a><a href="/projects/123/test">дубль</a>';
  assert.deepEqual(parsePublicProjects(html), [{ source: "kwork-public", title: "Сделать сайт", description: "Сделать сайт", url: "https://kwork.ru/projects/123/test" }]);
});

test("prefilterProjects ranks relevant work before sending it to the LLM", () => {
  const projects = [
    { title: "Логотип", description: "Нарисовать знак", url: "a" },
    { title: "Telegram бот", description: "Node API, бюджет: до 20000", url: "b" },
  ];
  assert.equal(prefilterProjects(projects, ["telegram", "node", "api"], 5)[0].url, "b");
});
