import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Code, gatewayBase, PageHeader, Panel, useSessionKey } from "@/components/qg/ui";
import { snippets } from "@/components/qg/snippets";

export const Route = createFileRoute("/_console/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — Q-GATE AI" },
      { name: "description", content: "Getting started, authentication, aliases, endpoints, streaming, errors, rate limits and data classification." },
      { property: "og:title", content: "Documentation — Q-GATE AI" },
      { property: "og:description", content: "Everything developers need to build on Q-GATE." },
    ],
  }),
  component: Docs,
});

function sections(base: string, key: string) {
  const s = snippets(base, key, "qz-code");
  return [
    { t: "Getting Started", b: "1) Create a project in the Developer Portal. 2) Request Model Access for an enterprise alias. 3) After approval open My AI Access, create a Q-GATE key and copy the endpoint. 4) Point any OpenAI- or Anthropic-compatible client at Q-GATE.", c: s.env },
    { t: "Authentication", b: "Send your Q-GATE key as `Authorization: Bearer qzg_…` (OpenAI style) or `x-api-key` (Anthropic style). Keys are bound to one project, environment, alias set and scopes. Provider credentials are never issued to developers." },
    { t: "Request Model Access", b: "Requests are evaluated by an automatic preflight (eligibility, team policy, environment, data class, alias policy, budget, security). Results: AUTO APPROVABLE, ADMIN APPROVAL REQUIRED, SECURITY REVIEW REQUIRED or DENIED." },
    { t: "My AI Access", b: "Lists ACTIVE entitlements with environment, maximum data class, budget, RPM/TPM, expiry and logging policy — plus your gateway endpoint." },
    { t: "API Keys", b: "Plaintext is shown once; Q-GATE stores a SHA-256 hash. Rotate to replace a lost key; the old key stops working immediately. Scopes: responses:write, chat:write, messages:write, embeddings:write, models:read, usage:read." },
    { t: "Gateway Endpoint", b: `Base URL: ${base}. You never need an underlying provider endpoint.` },
    { t: "Model Aliases", b: "qz-fast, qz-balanced, qz-reasoning, qz-code, qz-vision, qz-embedding. Admins map aliases to approved provider routes and version every change; your code keeps calling the alias." },
    { t: "OpenAI-Compatible Integration", b: "Set OPENAI_BASE_URL to the Q-GATE base URL and OPENAI_API_KEY to your Q-GATE key.", c: s.openai },
    { t: "Anthropic-Compatible Integration", b: "Point the Anthropic SDK base_url at the Q-GATE host; POST /v1/messages supports system prompts, tool definitions and streaming.", c: s.anthropic },
    { t: "Coding Tools", b: "Any tool supporting a custom OpenAI base URL works: configure base URL, Q-GATE key and model qz-code, then run the compatibility test on the Integration page — status becomes READY only after it passes." },
    { t: "Responses Endpoint", b: "POST /v1/responses — `input` (string or items), `instructions`, `stream`, `max_output_tokens`.", c: s.curl },
    { t: "Chat Endpoint", b: "POST /v1/chat/completions — OpenAI chat format; streaming via SSE with a final usage chunk.", c: s.python },
    { t: "Messages Endpoint", b: "POST /v1/messages — Anthropic format: message_start, content_block_delta, message_stop events when streaming." },
    { t: "Embeddings", b: "POST /v1/embeddings with model qz-embedding and `input` string or array." },
    { t: "Streaming", b: "Set `stream: true`. Q-GATE relays provider tokens as they arrive (no full buffering) and records Request Received → Provider Connected → First Token → Stream Complete in the trace." },
    { t: "Errors", b: "Normalized: invalid_key, key_expired, project_disabled, model_not_allowed, model_access_approval_required, environment_not_allowed, budget_exceeded, budget_warning, rate_limit_exceeded, policy_blocked, provider_unavailable. Every error includes message, request_id, retryable, policy_id and resolution.", c: `{\n  "error": {\n    "code": "model_not_allowed",\n    "message": "Your project does not currently have production access to qz-reasoning.",\n    "request_id": "qgr_3f9a…",\n    "retryable": false,\n    "policy_id": "ENT-002",\n    "resolution": "Submit a model access request for this alias in the Developer Portal."\n  }\n}` },
    { t: "Rate Limits", b: "Enforced server-side per key (RPM, rolling 60s window) and per entitlement. 429 responses are retryable. Team TPM is configured in the governance matrix." },
    { t: "Token Usage", b: "Responses include provider-reported usage. Cost = provider usage × effective configured price (ESTIMATED). When the provider omits usage Q-GATE infers it and marks USAGE ESTIMATED." },
    { t: "Data Classification", b: "PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED. Send `x-qgate-data-class` per request (defaults to the project classification). Restricted data is only routed to providers approved for Restricted." },
    { t: "Security", b: "Provider keys live server-side only. Every request re-checks key status, expiry, project, entitlement, environment, data class, DLP (demo detection), budget, rate limit, alias and routing policy. Admin changes apply on the next request." },
  ];
}

function Docs() {
  const sk = useSessionKey();
  const all = sections(gatewayBase(), sk?.key ?? "<Q-GATE KEY>");
  const [sel, setSel] = useState(all[0].t);
  const cur = all.find((s) => s.t === sel)!;
  return (
    <div className="space-y-6">
      <PageHeader index="Documentation" title="Q-GATE Developer Documentation" subtitle="Snippets are generated from the live gateway configuration." />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Panel className="h-fit p-2">
          {all.map((s) => <button key={s.t} onClick={() => setSel(s.t)} className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm ${sel === s.t ? "bg-accent font-semibold text-accent-foreground" : "hover:bg-muted"}`}>{s.t}</button>)}
        </Panel>
        <Panel className="space-y-4 p-6">
          <h2 className="text-xl font-semibold">{cur.t}</h2>
          <p className="leading-relaxed text-muted-foreground">{cur.b}</p>
          {cur.c && <Code code={cur.c} />}
        </Panel>
      </div>
    </div>
  );
}
