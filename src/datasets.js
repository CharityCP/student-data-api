import Papa from "papaparse";
import datasetRegistry from "../config/datasets.json" with { type: "json" };

const parsedDatasetCache = new Map();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function listDatasets() {
  return Object.entries(datasetRegistry).map(([id, dataset]) => ({
    id,
    description: dataset.description,
  }));
}

export function getDatasetDefinition(id) {
  return datasetRegistry[id] ?? null;
}

export function parseCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const fatalErrors = parsed.errors.filter((error) => error.type !== "FieldMismatch");
  if (fatalErrors.length > 0) {
    throw new Error(`CSV parsing failed: ${fatalErrors[0].message}`);
  }

  return parsed.data;
}

export async function loadDataset(env, id, requestUrl) {
  const definition = getDatasetDefinition(id);
  if (!definition) return null;

  if (parsedDatasetCache.has(id)) return parsedDatasetCache.get(id);

  if (!env.ASSETS?.fetch) {
    throw new Error("The ASSETS binding is unavailable. Run `npm run build` before starting Wrangler.");
  }

  const assetUrl = new URL(`/${definition.file}`, requestUrl);
  const assetResponse = await env.ASSETS.fetch(assetUrl);
  if (!assetResponse.ok) {
    throw new Error(`Could not load ${definition.file} (${assetResponse.status}).`);
  }

  const dataset = {
    id,
    definition,
    records: parseCsv(await assetResponse.text()),
  };
  parsedDatasetCache.set(id, dataset);
  return dataset;
}

export function parseQuery(url, overrides = {}) {
  const defaultLimit = overrides.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = overrides.maxLimit ?? MAX_LIMIT;
  return {
    limit: toBoundedInteger(url.searchParams.get("limit"), defaultLimit, 1, maxLimit),
    offset: toBoundedInteger(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER),
    search: (url.searchParams.get("search") ?? "").trim(),
  };
}

export function filterRecords(records, { search = "", limit = DEFAULT_LIMIT, offset = 0 }) {
  const normalizedSearch = search.trim();
  const matcher = normalizedSearch ? new RegExp(escapeRegExp(normalizedSearch), "iu") : null;
  const matches = matcher
    ? records.filter((record) =>
        Object.values(record).some((value) =>
          matcher.test(String(value ?? "")),
        ),
      )
    : records;

  return {
    records: matches.slice(offset, offset + limit),
    total: matches.length,
    count: Math.max(0, Math.min(limit, matches.length - offset)),
  };
}

export async function queryDataset(env, id, query, requestUrl) {
  const dataset = await loadDataset(env, id, requestUrl);
  if (!dataset) return null;

  const result = filterRecords(dataset.records, query);
  return {
    dataset: id,
    count: result.records.length,
    total: result.total,
    limit: query.limit,
    offset: query.offset,
    records: result.records,
  };
}

function toBoundedInteger(rawValue, fallback, min, max) {
  if (rawValue === null || rawValue === "") return fallback;
  const number = Number(rawValue);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
