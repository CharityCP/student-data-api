import toolsConfig from "../config/tools.json" with { type: "json" };
import { queryDataset } from "./datasets.js";

export function datasetToolDefinition() {
  return {
    name: "query_dataset",
    description:
      "Search the dataset selected by the API route. Returns matching CSV records. The dataset cannot be changed by this tool.",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Case-insensitive text to find in any field. Use an empty string to inspect general records.",
        },
        limit: {
          type: "integer",
          description: `Number of records to return, at most ${toolsConfig.query_dataset.max_limit}.`,
        },
        offset: {
          type: "integer",
          description: "Number of matching records to skip.",
        },
      },
    },
  };
}

export function normalizeToolArguments(argumentsValue = {}) {
  const config = toolsConfig.query_dataset;
  let args = argumentsValue;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      args = {};
    }
  }

  const requestedLimit = Number(args.limit);
  const requestedOffset = Number(args.offset);
  return {
    search: config.allow_search ? String(args.search ?? "").trim() : "",
    limit: Number.isInteger(requestedLimit)
      ? Math.min(config.max_limit, Math.max(1, requestedLimit))
      : config.default_limit,
    offset:
      config.allow_offset && Number.isInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0,
  };
}

export async function runDatasetTool(env, datasetId, args, requestUrl) {
  if (!toolsConfig.query_dataset.enabled) {
    throw new Error("The query_dataset tool is disabled.");
  }
  const normalized = normalizeToolArguments(args);
  const result = await queryDataset(env, datasetId, normalized, requestUrl);
  return { arguments: normalized, result };
}

export function maxToolCalls() {
  return toolsConfig.query_dataset.max_calls;
}
