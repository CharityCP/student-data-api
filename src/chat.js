import llmConfig from "../config/llm.json" with { type: "json" };
import { loadDataset, filterRecords } from "./datasets.js";
import { datasetToolDefinition, maxToolCalls, runDatasetTool } from "./tools.js";

const STOP_WORDS = new Set([
  "about", "after", "also", "appear", "could", "dataset", "does", "from", "have", "into",
  "many", "more", "most", "records", "show", "tell", "that", "their", "there", "these", "they",
  "this", "what", "when", "where", "which", "with", "would", "your",
]);

export async function chatWithDataset(env, datasetId, message, requestUrl) {
  const usage = { total_tokens: 0, ai_calls: 0, estimated: false };
  if (!env.AI?.run) {
    return mockChat(env, datasetId, message, requestUrl, "Workers AI is not available locally.", usage);
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          `You answer questions about the \"${datasetId}\" CSV dataset. Always call query_dataset before answering. ` +
          "Choose a concise search term from the question, or use an empty search to inspect records. Never claim facts not present in tool results.",
      },
      { role: "user", content: message },
    ];

    let planning = await runAI(env, {
      messages,
      tools: [datasetToolDefinition()],
      temperature: llmConfig.temperature,
      max_tokens: llmConfig.max_tokens,
    }, usage);

    let requestedCalls = normalizeToolCalls(planning.tool_calls);
    if (requestedCalls.length === 0) {
      planning = await runAI(env, {
        messages: [...messages, { role: "user", content: "Call query_dataset now before answering." }],
        tools: [datasetToolDefinition()],
        temperature: 0,
        max_tokens: llmConfig.max_tokens,
      }, usage);
      requestedCalls = normalizeToolCalls(planning.tool_calls);
    }

    if (requestedCalls.length === 0) {
      return mockChat(env, datasetId, message, requestUrl, "The model did not request the dataset tool.", usage);
    }

    const toolCalls = [];
    const toolResults = [];
    for (const call of requestedCalls.slice(0, maxToolCalls())) {
      if (call.name !== "query_dataset") continue;
      const execution = await runDatasetTool(env, datasetId, call.arguments, requestUrl);
      toolCalls.push({ tool: "query_dataset", arguments: execution.arguments });
      toolResults.push(execution.result);
    }

    if (toolResults.length === 0) {
      return mockChat(env, datasetId, message, requestUrl, "The model requested an unknown tool.", usage);
    }

    const grounded = await runAI(env, {
      messages: [
        {
          role: "system",
          content:
            "Answer using only the supplied dataset tool results. Be concise, mention when the records are insufficient, and do not invent values.",
        },
        {
          role: "user",
          content: `Question: ${message}\n\nDataset tool results:\n${JSON.stringify(toolResults)}`,
        },
      ],
      temperature: llmConfig.temperature,
      max_tokens: llmConfig.max_tokens,
    }, usage);

    return {
      dataset: datasetId,
      response: extractText(grounded),
      tool_calls: toolCalls,
      mode: "workers-ai",
      model: llmConfig.model,
      usage,
    };
  } catch (error) {
    console.error("Workers AI chat failed; returning local fallback.", error);
    return mockChat(env, datasetId, message, requestUrl, "Workers AI was unavailable for this request.", usage);
  }
}

async function runAI(env, input, usage) {
  usage.ai_calls += 1;
  try {
    const result = await env.AI.run(llmConfig.model, input);
    const reportedTokens = getReportedTotalTokens(result);
    if (reportedTokens === null) {
      usage.total_tokens += estimateTokens(input, result);
      usage.estimated = true;
    } else {
      usage.total_tokens += reportedTokens;
    }
    return result;
  } catch (error) {
    usage.total_tokens += estimateTokens(input);
    usage.estimated = true;
    throw error;
  }
}

function getReportedTotalTokens(result) {
  const value = result?.usage?.total_tokens ?? result?.result?.usage?.total_tokens;
  const tokens = Number(value);
  return Number.isFinite(tokens) && tokens >= 0 ? Math.round(tokens) : null;
}

function estimateTokens(input, result) {
  const text = `${JSON.stringify(input)}${result === undefined ? "" : JSON.stringify(result)}`;
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.map((call) => ({
    name: call.name ?? call.function?.name,
    arguments: call.arguments ?? call.function?.arguments ?? {},
  }));
}

function extractText(result) {
  if (typeof result === "string") return result;
  return result?.response ?? result?.result?.response ?? "The model returned no text response.";
}

async function mockChat(env, datasetId, message, requestUrl, reason, usage) {
  const dataset = await loadDataset(env, datasetId, requestUrl);
  const search = chooseMockSearch(dataset.records, message);
  const query = { search, limit: 10, offset: 0 };
  const result = filterRecords(dataset.records, query);
  const preview = result.records.slice(0, 3);

  return {
    dataset: datasetId,
    response:
      `Preview mode searched for ${search ? `\"${search}\"` : "all records"} and found ${result.total} match${result.total === 1 ? "" : "es"}. ` +
      (preview.length
        ? `Here are sample matching records: ${preview.map(summarizeRecord).join("; ")}.`
        : "Try a different or shorter search term."),
    tool_calls: [{ tool: "query_dataset", arguments: query }],
    mode: "mock",
    note: `${reason} Deploy to Cloudflare to use the configured Workers AI model.`,
    usage,
  };
}

function chooseMockSearch(records, message) {
  const quoted = message.match(/["“]([^"”]+)["”]/)?.[1]?.trim();
  if (quoted && filterRecords(records, { search: quoted, limit: 1, offset: 0 }).total > 0) return quoted;

  const candidates = message
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu)
    ?.filter((word) => !STOP_WORDS.has(word)) ?? [];

  let best = { word: "", count: 0 };
  for (const word of [...new Set(candidates)]) {
    const count = filterRecords(records, { search: word, limit: 1, offset: 0 }).total;
    if (count > best.count) best = { word, count };
  }
  return best.word;
}

function summarizeRecord(record) {
  return Object.entries(record)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}
