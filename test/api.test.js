import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import worker from "../src/index.js";
import { filterRecords, parseCsv } from "../src/datasets.js";

const root = resolve(import.meta.dirname, "..");
const env = {
  ASSETS: {
    async fetch(input) {
      const url = new URL(input.url ?? input);
      try {
        const body = await readFile(resolve(root, url.pathname.slice(1)));
        return new Response(body, { status: 200 });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  },
};

test("CSV parsing supports quoted commas and empty values", () => {
  const records = parseCsv('name,tags,note\nAda,"math, code",\n');
  assert.deepEqual(records, [{ name: "Ada", tags: "math, code", note: "" }]);
});

test("record filtering searches every field with a safe case-insensitive regex and paginates", () => {
  const records = [
    { artist: "Dolly Parton", song: "Jolene" },
    { artist: "Dolly Parton", song: "9 to 5" },
    { artist: "Prince", song: "C++" },
  ];
  const result = filterRecords(records, { search: "dolly", limit: 1, offset: 1 });
  assert.equal(result.total, 2);
  assert.deepEqual(result.records, [{ artist: "Dolly Parton", song: "9 to 5" }]);

  const specialCharacters = filterRecords(records, { search: "C++", limit: 10, offset: 0 });
  assert.equal(specialCharacters.total, 1);
  assert.equal(specialCharacters.records[0].artist, "Prince");
});

test("lists configured datasets", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/v1/datasets"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.datasets.map(({ id }) => id), ["cats", "board-games", "viral-50-usa"]);
});

test("root shows a concise deployment success and route help page", async () => {
  const response = await worker.fetch(new Request("https://student.example.com/"), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  const body = await response.text();
  assert.match(body, /Deployment successful/);
  assert.match(body, /\/api\/v1\/datasets\/\{dataset\}\/records/);
  assert.match(body, /await/);
  assert.match(body, /console\.log/);
  assert.match(body, /https:\/\/student\.example\.com\/api\/v1\/datasets/);
});

test("returns search-filtered dataset records", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/viral-50-usa/records?search=dolly&limit=2&offset=1"),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.dataset, "viral-50-usa");
  assert.equal(body.count, 2);
  assert.match(body.records[0].Artist, /Dolly Parton/);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("only search is recognized as the record filter parameter", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/cats/records?search=egypt&limit=10"),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 3);

  const ignoredQResponse = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/cats/records?q=egypt&limit=10"),
    env,
  );
  const ignoredQBody = await ignoredQResponse.json();
  assert.ok(ignoredQBody.total > body.total);
});

test("returns a useful unknown dataset error", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/v1/datasets/nope/records"), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "dataset_not_found");
});

test("chat works in mock mode without an AI binding", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/viral-50-usa/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Which Dolly Parton songs appear?" }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "mock");
  assert.equal(body.tool_calls[0].tool, "query_dataset");
  assert.match(body.response, /Dolly/i);
  assert.deepEqual(body.usage, { total_tokens: 0, ai_calls: 0, estimated: false });
});

test("chat aggregates reported token usage across Workers AI calls", async () => {
  const responses = [
    {
      tool_calls: [{ name: "query_dataset", arguments: { search: "Dolly", limit: 10 } }],
      usage: { prompt_tokens: 70, completion_tokens: 10, total_tokens: 80 },
    },
    {
      response: "Dolly Parton appears in the dataset.",
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    },
  ];
  const aiEnv = {
    ...env,
    AI: {
      async run() {
        return responses.shift();
      },
    },
  };

  const response = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/viral-50-usa/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Which Dolly Parton songs appear?" }),
    }),
    aiEnv,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "workers-ai");
  assert.deepEqual(body.usage, { total_tokens: 200, ai_calls: 2, estimated: false });
  assert.deepEqual(Object.keys(body.usage).sort(), ["ai_calls", "estimated", "total_tokens"]);
});

test("chat clearly marks fallback token totals as estimated", async () => {
  const responses = [
    { tool_calls: [{ name: "query_dataset", arguments: { search: "Dolly" } }] },
    { response: "Dolly Parton appears in the dataset." },
  ];
  const aiEnv = {
    ...env,
    AI: { async run() { return responses.shift(); } },
  };

  const response = await worker.fetch(
    new Request("https://example.com/api/v1/datasets/viral-50-usa/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Which Dolly Parton songs appear?" }),
    }),
    aiEnv,
  );
  const body = await response.json();
  assert.equal(body.usage.ai_calls, 2);
  assert.equal(body.usage.estimated, true);
  assert.ok(body.usage.total_tokens > 0);
});
