import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, x-qgate-budget-action, x-qgate-data-class, anthropic-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-qgate-request-id, x-qgate-fallback, x-qgate-simulated, x-qgate-redacted, x-qgate-budget-warning",
};

function keyFrom(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer || request.headers.get("x-api-key")?.trim() || "";
}
function err(status: number, code: string, message: string) {
  return Response.json({ error: { type: code, code, message, request_id: null, retryable: false } }, { status, headers: CORS });
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        if (params._splat !== "models") return err(404, "not_found", "Unknown endpoint");
        const raw = keyFrom(request);
        if (!raw) return err(401, "invalid_key", "Missing Q-GATE key.");
        const { listModelsForKey } = await import("@/lib/qgate/gateway.server");
        const out = await listModelsForKey(raw);
        if (!out) return err(401, "invalid_key", "The Q-GATE key is invalid, expired, revoked or lacks models:read.");
        return Response.json(out, { headers: CORS });
      },
      POST: async ({ request, params }) => {
        const ep = params._splat;
        if (!["responses", "chat/completions", "messages", "embeddings"].includes(ep ?? "")) return err(404, "not_found", "Unknown endpoint");
        const raw = keyFrom(request);
        if (!raw) return err(401, "invalid_key", "Missing Q-GATE key.");
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return err(400, "invalid_request", "Body must be JSON.");
        }
        const { runGateway } = await import("@/lib/qgate/gateway.server");
        const r = await runGateway({
          endpoint: ep as "responses",
          body,
          auth: { kind: "key", raw },
          budgetAction: request.headers.get("x-qgate-budget-action"),
          dataClass: request.headers.get("x-qgate-data-class"),
        });
        const headers = { ...CORS, ...r.headers };
        if (r.stream) return new Response(r.stream, { status: r.status, headers });
        return Response.json(r.json, { status: r.status, headers });
      },
    },
  },
});
