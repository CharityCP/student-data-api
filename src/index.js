import { chatWithDataset } from "./chat.js";
import { getDatasetDefinition, listDatasets, parseQuery, queryDataset } from "./datasets.js";
import { apiError, json, optionsResponse } from "./http.js";
import { landingPage } from "./landing.js";

const DATASET_ROUTE = /^\/api\/v1\/datasets\/([^/]+)\/(records|chat)\/?$/;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return optionsResponse();

    const url = new URL(request.url);
    try {
      if (url.pathname === "/" && request.method === "GET") return landingPage(url, listDatasets());

      if (url.pathname === "/api/v1/datasets" || url.pathname === "/api/v1/datasets/") {
        if (request.method !== "GET") return methodNotAllowed("GET");
        return json({ datasets: listDatasets() });
      }

      const match = url.pathname.match(DATASET_ROUTE);
      if (!match) return apiError(404, "not_found", "No API route matches this URL.");

      const [, datasetId, action] = match;
      if (!getDatasetDefinition(datasetId)) {
        return apiError(404, "dataset_not_found", `Dataset \"${datasetId}\" is not registered.`);
      }

      if (action === "records") {
        if (request.method !== "GET") return methodNotAllowed("GET");
        return json(await queryDataset(env, datasetId, parseQuery(url), url));
      }

      if (request.method !== "POST") return methodNotAllowed("POST");
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return apiError(415, "unsupported_media_type", "Send a JSON body with Content-Type: application/json.");
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return apiError(400, "invalid_json", "The request body is not valid JSON.");
      }

      const message = typeof body?.message === "string" ? body.message.trim() : "";
      if (!message) return apiError(400, "message_required", "The JSON body must include a non-empty message string.");
      if (message.length > 2000) return apiError(400, "message_too_long", "Messages must be 2,000 characters or fewer.");

      return json(await chatWithDataset(env, datasetId, message, url));
    } catch (error) {
      console.error(error);
      return apiError(500, "internal_error", "The API could not complete this request.");
    }
  },
};

function methodNotAllowed(allowed) {
  return apiError(405, "method_not_allowed", `Use ${allowed} for this endpoint.`, { allowed });
}
