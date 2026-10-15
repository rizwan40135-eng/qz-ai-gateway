/* Q-GATE gateway pipeline. Server-only: never import from browser code. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { classRank, ENDPOINT_SCOPE } from "./constants";
import { decide, redact, scanText, type DlpPolicy } from "./dlp";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabaseAdmin as any;

export type Endpoint = "responses" | "chat/completions" | "messages" | "embeddings";
export type GwAuth = { kind: "key"; raw: string } | { kind: "console"; actor: string; projectId: string };
export interface GwRequest {
  endpoint: Endpoint;
  body: any;
  auth: GwAuth;
  budgetAction?: string | null;
  dataClass?: string | null;
}
export interface GwResult {
  status: number;
  json?: any;
  stream?: ReadableStream<Uint8Array>;
  headers: Record<string, string>;
}
interface Step {
  n: string;
  result: "PASS" | "FAIL" | "WARN" | "INFO" | "SKIP";
  ms: number;
  detail: string;
}

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randHex(n: number) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, n);
}
function hashNum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const RESOLUTIONS: Record<string, string> = {
  invalid_key: "Check the Authorization header carries an active Q-GATE key (qzg_live_… / qzg_test_…).",
  key_expired: "Rotate the key or ask your Team Admin to extend it.",
  project_disabled: "Ask the project owner to re-activate the project.",
  model_not_allowed: "Submit a model access request for this alias in the Developer Portal.",
  model_access_approval_required: "Submit a temporary-access request; an admin must approve it.",
  environment_not_allowed: "Request access for this environment or use a key scoped to it.",
  data_class_not_allowed: "Lower the data classification or request a higher classification entitlement.",
  budget_exceeded: "Request a budget increase from FinOps.",
  budget_warning: "Resend with header x-qgate-budget-action: continue | use-lower-cost, or request budget.",
  rate_limit_exceeded: "Back off and retry after 60 seconds, or request a higher RPM.",
  policy_blocked: "Remove the sensitive content or request a policy exception.",
  approval_required: "This content requires approval; submit a policy exception request.",
  provider_unavailable: "No permitted route is healthy. Retry shortly; Q-GATE has alerted the platform team.",
  scope_missing: "Create a key with the required scope.",
};

function textOf(c: any): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : p?.text ?? p?.content ?? "")).map(textOf).join("\n");
  if (c && typeof c === "object") return textOf(c.text ?? c.content ?? "");
  return "";
}

function toChatMessages(endpoint: Endpoint, body: any): { role: string; content: string }[] {
  const msgs: { role: string; content: string }[] = [];
  if (endpoint === "responses") {
    if (body.instructions) msgs.push({ role: "system", content: String(body.instructions) });
    if (typeof body.input === "string") msgs.push({ role: "user", content: body.input });
    else if (Array.isArray(body.input)) for (const it of body.input) msgs.push({ role: it.role ?? "user", content: textOf(it.content ?? it) });
  } else if (endpoint === "messages") {
    if (body.system) msgs.push({ role: "system", content: textOf(body.system) });
    for (const m of body.messages ?? []) msgs.push({ role: m.role, content: textOf(m.content) });
  } else if (endpoint === "chat/completions") {
    for (const m of body.messages ?? []) msgs.push({ role: m.role, content: textOf(m.content) });
  } else {
    const inp = Array.isArray(body.input) ? body.input : [body.input ?? ""];
    for (const s of inp) msgs.push({ role: "user", content: String(s) });
  }
  return msgs;
}

class ProviderError extends Error {
  constructor(public code: string, msg: string) {
    super(msg);
  }
}

type Chunk = { delta?: string; usage?: { input: number; output: number } };

async function* demoProvider(model: any, msgs: { role: string; content: string }[]): AsyncGenerator<Chunk> {
  const last = msgs.filter((m) => m.role !== "system").at(-1)?.content ?? "";
  const h = hashNum(last + model.id);
  const phrases = [
    "The request was evaluated by every configured Q-GATE policy layer before reaching this route.",
    "Your enterprise alias resolved to an approved route; application code does not reference the provider.",
    "Token usage, estimated cost and latency have been recorded against your project and key.",
  ];
  const text = `SIMULATED PROVIDER RESPONSE — Demo Provider (${model.provider_model}). ${phrases[h % 3]} Prompt fingerprint ${h.toString(16).slice(0, 6)}; ${last.split(/\s+/).filter(Boolean).length} words received.`;
  for (const w of text.split(" ")) {
    await new Promise((r) => setTimeout(r, 12));
    yield { delta: w + " " };
  }
  yield { usage: { input: Math.ceil(msgs.map((m) => m.content).join(" ").length / 4), output: Math.ceil(text.length / 4) } };
}

async function* openaiCompatible(url: string, key: string, model: string, msgs: any[], maxTokens?: number, temperature?: number): AsyncGenerator<Chunk> {
  const payload: any = { model, messages: msgs, stream: true, stream_options: { include_usage: true } };
  if (model.startsWith("openai/gpt-5.6")) payload.reasoning_effort = "none";
  if (maxTokens) payload.max_completion_tokens = maxTokens;
  if (temperature !== undefined && !model.startsWith("openai/")) payload.temperature = temperature;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new ProviderError(res.status === 429 ? "provider_rate_limited" : res.status >= 500 ? "provider_5xx" : "provider_4xx", `Provider returned ${res.status}: ${t.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const d = j.choices?.[0]?.delta?.content;
        if (d) yield { delta: d };
        if (j.usage) yield { usage: { input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 } };
      } catch {
        /* partial */
      }
    }
  }
}

async function* anthropicNative(url: string, key: string, model: string, msgs: any[], maxTokens?: number): AsyncGenerator<Chunk> {
  const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const res = await fetch(url.replace(/\/$/, "") + "/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, system: system || undefined, max_tokens: maxTokens ?? 1024, messages: msgs.filter((m) => m.role !== "system") }),
  });
  if (!res.ok) throw new ProviderError(res.status >= 500 ? "provider_5xx" : "provider_4xx", `Provider returned ${res.status}`);
  const j: any = await res.json();
  yield { delta: (j.content ?? []).map((c: any) => c.text ?? "").join("") };
  yield { usage: { input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0 } };
}

async function providerStream(model: any, provider: any, msgs: any[], opts: { maxTokens?: number; temperature?: number }) {
  if (provider.simulated_outage || model.simulated_outage) throw new ProviderError("provider_5xx", `${provider.name} · ${model.provider_model} health check failing (simulated outage)`);
  if (provider.status !== "enabled") throw new ProviderError("provider_unavailable", `${provider.name} is ${provider.status}`);
  if (provider.id === "demo") return { gen: demoProvider(model, msgs), simulated: true };
  if (provider.id === "lovable-ai") {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { gen: demoProvider(model, msgs), simulated: true };
    return { gen: openaiCompatible("https://ai.gateway.lovable.dev/v1/chat/completions", key, model.provider_model, msgs, opts.maxTokens, opts.temperature), simulated: false };
  }
  const { data: sec } = await db.from("provider_secrets").select("secret").eq("provider_id", provider.id).eq("slot", "active").maybeSingle();
  if (!sec) return { gen: demoProvider(model, msgs), simulated: true };
  if (provider.kind === "Anthropic") return { gen: anthropicNative(provider.base_url, sec.secret, model.provider_model, msgs, opts.maxTokens), simulated: false };
  return { gen: openaiCompatible(provider.base_url.replace(/\/$/, "") + "/chat/completions", sec.secret, model.provider_model, msgs, opts.maxTokens, opts.temperature), simulated: false };
}

function sse(event: string | null, data: any) {
  return (event ? `event: ${event}\n` : "") + `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

export async function runGateway(req: GwRequest): Promise<GwResult> {
  const reqId = "qgr_" + randHex(16);
  const t0 = Date.now();
  let last = t0;
  const steps: Step[] = [];
  const step = (n: string, result: Step["result"], detail: string) => {
    const now = Date.now();
    steps.push({ n, result, ms: now - last, detail });
    last = now;
  };
  const ctx: any = { endpoint: "/v1/" + req.endpoint, alias: req.body?.model ?? null };
  const headers: Record<string, string> = { "x-qgate-request-id": reqId };

  const fail = async (status: number, code: string, message: string, extra: { policyId?: string; retryable?: boolean; options?: string[] } = {}) => {
    step(steps.length < 2 ? "Q-GATE Key Authenticated" : "Request Rejected", "FAIL", message);
    await db.from("traces").insert({
      id: reqId,
      user_name: ctx.user ?? "unknown",
      team: ctx.team,
      project_name: ctx.project,
      key_prefix: ctx.keyPrefix,
      alias: ctx.alias,
      endpoint: ctx.endpoint,
      environment: ctx.env,
      status,
      error_code: code,
      policy_id: extra.policyId,
      policy_result: "BLOCKED",
      latency_ms: Date.now() - t0,
      steps,
      logging: ctx.logging,
    });
    if (["policy_blocked", "model_not_allowed", "model_access_approval_required", "data_class_not_allowed", "budget_exceeded"].includes(code))
      await db.from("audit_events").insert({ actor: ctx.user ?? "unknown", action: "Request Blocked", resource: `alias:${ctx.alias}`, new_value: code, reason: message, request_id: reqId });
    return {
      status,
      headers,
      json: {
        error: {
          type: code,
          code,
          message,
          request_id: reqId,
          retryable: extra.retryable ?? false,
          policy_id: extra.policyId ?? null,
          resolution: RESOLUTIONS[code] ?? null,
          options: extra.options,
        },
      },
    };
  };

  step("Request Received", "PASS", `${ctx.endpoint} · stream=${!!req.body?.stream}`);

  // --- Identity / key
  let key: any = null;
  let project: any;
  if (req.auth.kind === "key") {
    const hash = await sha256(req.auth.raw);
    const { data } = await db.from("gateway_keys").select("*").eq("key_hash", hash).maybeSingle();
    key = data;
    if (!key) return fail(401, "invalid_key", "The Q-GATE key is not recognized.");
    ctx.keyPrefix = `${key.prefix}••••${key.last4}`;
    ctx.user = key.owner_name;
    if (key.status !== "active") return fail(401, "invalid_key", `The Q-GATE key is ${key.status}.`, { policyId: "SEC-001" });
    if (key.expires_at && new Date(key.expires_at) < new Date()) return fail(401, "key_expired", "The Q-GATE key has expired.", { policyId: "SEC-001" });
    const scope = ENDPOINT_SCOPE[req.endpoint];
    if (scope && !(key.scopes ?? []).includes(scope)) return fail(403, "scope_missing", `Key lacks scope ${scope}.`);
    step("Q-GATE Key Authenticated", "PASS", `${ctx.keyPrefix} · ${key.kind} credential · scope ${scope}`);
    const { data: p } = await db.from("projects").select("*").eq("id", key.project_id).maybeSingle();
    project = p;
  } else {
    ctx.user = req.auth.actor;
    ctx.keyPrefix = "console-session";
    step("Q-GATE Key Authenticated", "PASS", "Signed-in console session (Playground)");
    const { data: p } = await db.from("projects").select("*").eq("id", req.auth.projectId).maybeSingle();
    project = p;
  }
  if (!project) return fail(404, "project_disabled", "Project not found for this credential.");
  ctx.project = project.name;
  ctx.team = project.team;
  ctx.env = key?.environment ?? project.environment;
  if (project.status !== "active") return fail(403, "project_disabled", `Project ${project.name} is ${project.status}.`);
  step("Project Resolved", "PASS", `${project.name} · ${project.team} · ${ctx.env}`);

  // --- Entitlement
  let alias: string = req.body?.model ?? "";
  if (req.endpoint === "embeddings" && !alias) alias = "qz-embedding";
  const { data: aliasRow0 } = await db.from("aliases").select("*").eq("alias", alias).maybeSingle();
  if (!aliasRow0) return fail(400, "model_not_allowed", `Unknown enterprise alias "${alias}". Use an approved qz-* alias.`);

  // Budget lower-cost recommendation may swap alias before entitlement checks.
  const { data: gov } = await db.from("governance").select("*").eq("team", project.team).maybeSingle();
  const teamPct = gov ? (Number(gov.spent_usd) / Number(gov.budget_usd)) * 100 : 0;
  if (gov && teamPct >= 90 && teamPct < 100 && gov.enforcement === "Recommend Lower-Cost Alias" && req.budgetAction === "use-lower-cost" && alias === "qz-reasoning") {
    alias = "qz-balanced";
  }
  ctx.alias = alias;
  const { data: aliasRow } = await db.from("aliases").select("*").eq("alias", alias).maybeSingle();

  if (key && !(key.aliases ?? []).includes(alias)) return fail(403, "model_not_allowed", `This key is not scoped to ${alias}.`, { policyId: "ENT-002" });
  const { data: ents } = await db.from("entitlements").select("*").eq("project_id", project.id).eq("alias", alias).eq("status", "active");
  const cands = (ents ?? []).filter((e: any) => e.environment === ctx.env && (!e.expires_at || new Date(e.expires_at) > new Date()));
  const ent = cands.find((e: any) => e.exception) ?? cands[0];
  if (!ent) {
    const anyEnv = (ents ?? []).length > 0;
    return anyEnv
      ? fail(403, "environment_not_allowed", `Your project does not currently have ${ctx.env} access to ${alias}.`, { policyId: "ENV-003" })
      : fail(403, "model_not_allowed", `Your project does not currently have ${ctx.env.toLowerCase()} access to ${alias}.`, { policyId: "ENT-002" });
  }
  ctx.logging = ent.logging;
  const epKey = req.endpoint === "chat/completions" ? "chat" : req.endpoint;
  if (ent.endpoints && !ent.endpoints.includes(epKey)) return fail(403, "model_not_allowed", `Endpoint /v1/${req.endpoint} not allowed by entitlement.`, { policyId: "ENT-002" });
  const { data: mrows } = await db.from("matrix").select("*").eq("team", project.team).eq("alias", alias);
  const mrow = (mrows ?? []).find((m: any) => m.environment === ctx.env) ?? (mrows ?? []).find((m: any) => m.environment === "*");
  const mstate = mrow?.state ?? "APPROVAL REQUIRED";
  if (mstate === "DENIED") return fail(403, "model_not_allowed", `${project.team} is denied ${alias} in ${ctx.env} by central governance.`, { policyId: "ENT-002" });
  if (mstate === "APPROVAL REQUIRED" && !ent.exception)
    return fail(403, "model_access_approval_required", `MODEL ACCESS APPROVAL REQUIRED: ${alias} in ${ctx.env} now requires an approved exception for ${project.team}.`, { policyId: "ENT-002" });
  step("Entitlement Checked", "PASS", `Active entitlement for ${alias} · matrix ${mstate}${ent.exception ? " (approved exception)" : ""}`);

  if (!aliasRow.environments.includes(ctx.env)) return fail(403, "environment_not_allowed", `${alias} is not approved for ${ctx.env}.`, { policyId: "ENV-003" });
  step("Environment Checked", "PASS", `${ctx.env} permitted for ${alias}`);

  // --- Data classification
  const dataClass = (req.dataClass ?? req.body?.metadata?.data_classification ?? project.data_class).toUpperCase();
  if (classRank(dataClass) > classRank(ent.max_class) || classRank(dataClass) > classRank(aliasRow.max_class))
    return fail(403, "data_class_not_allowed", `${dataClass} data exceeds the maximum permitted (${ent.max_class}) for this entitlement.`, { policyId: "DATA-004" });
  step("Data Policy Checked", "PASS", `${dataClass} ≤ ${ent.max_class}`);

  // --- Budget
  const entPct = (Number(ent.spent_usd) / Number(ent.monthly_budget)) * 100;
  if (entPct >= 100) return fail(402, "budget_exceeded", `Entitlement budget of $${ent.monthly_budget} is exhausted.`, { policyId: "BUD-016" });
  let budgetNote = `Entitlement ${entPct.toFixed(1)}% · team ${teamPct.toFixed(1)}%`;
  if (gov && teamPct >= 100) return fail(402, "budget_exceeded", `${project.team} has exhausted its monthly budget.`, { policyId: "BUD-016" });
  if (gov && teamPct >= 90) {
    const enf = gov.enforcement;
    if (enf === "Block") return fail(402, "budget_exceeded", `${project.team} is at ${teamPct.toFixed(0)}% of budget; policy blocks further usage.`, { policyId: "BUD-015" });
    if (enf === "Approval Required" && req.budgetAction !== "continue")
      return fail(402, "budget_warning", `BUDGET WARNING: ${project.team} is at ${teamPct.toFixed(0)}% of budget. FinOps approval required.`, { policyId: "BUD-015", options: ["Request Budget"] });
    if (enf === "Recommend Lower-Cost Alias" && !req.budgetAction && alias === "qz-reasoning")
      return fail(402, "budget_warning", `BUDGET WARNING: ${project.team} is at ${teamPct.toFixed(0)}% of budget. Consider qz-balanced.`, { policyId: "BUD-015", options: ["Continue", "Use qz-balanced", "Request Budget"] });
    headers["x-qgate-budget-warning"] = `${teamPct.toFixed(0)}%`;
    budgetNote += ` · WARNING (${enf}${req.budgetAction ? `, ${req.budgetAction}` : ""})`;
  }
  step("Budget Checked", gov && teamPct >= 90 ? "WARN" : "PASS", budgetNote);

  // --- Rate limit
  if (key) {
    const now = Date.now();
    const winStart = key.rpm_window_start ? new Date(key.rpm_window_start).getTime() : 0;
    const fresh = now - winStart > 60000;
    const count = fresh ? 1 : key.rpm_count + 1;
    await db.from("gateway_keys").update({ rpm_window_start: fresh ? new Date(now).toISOString() : key.rpm_window_start, rpm_count: count }).eq("id", key.id);
    const limit = Math.min(key.rpm, ent.rpm);
    if (count > limit) return fail(429, "rate_limit_exceeded", `Rate limit of ${limit} requests/minute exceeded.`, { policyId: "RATE-017", retryable: true });
    step("Rate Limit Checked", "PASS", `${count}/${limit} RPM`);
  } else step("Rate Limit Checked", "PASS", `Console session · entitlement ${ent.rpm} RPM`);

  // --- Content guardrails
  const { data: pol } = await db.from("policies").select("*").in("layer", ["Content", "Tool Access"]);
  const content = (pol ?? []).filter((p: any) => p.layer === "Content") as DlpPolicy[];
  let msgs = toChatMessages(req.endpoint, req.body ?? {});
  const all = msgs.map((m) => m.content).join("\n");
  const findings = scanText(all, content);
  const decision = decide(findings);
  if (decision === "BLOCK") {
    const f = findings.find((x) => x.action === "BLOCK")!;
    return fail(403, "policy_blocked", `REQUEST BLOCKED — ${f.policyId === "SEC-014" ? "Potential secret detected" : f.name} (DEMO POLICY DETECTION).`, { policyId: f.policyId });
  }
  if (decision === "REQUIRE APPROVAL") {
    const f = findings.find((x) => x.action === "REQUIRE APPROVAL")!;
    return fail(403, "approval_required", `Content matched ${f.name}; approval required before processing.`, { policyId: f.policyId });
  }
  let policyResult = "PASS";
  if (decision === "REDACT") {
    msgs = msgs.map((m) => ({ ...m, content: redact(m.content, findings) }));
    policyResult = "REDACTED";
    headers["x-qgate-redacted"] = findings.map((f) => f.policyId).join(",");
  }
  let toolNote = "";
  if (Array.isArray(req.body?.tools) && req.body.tools.length) {
    const tools = (pol ?? []).filter((p: any) => p.layer === "Tool Access");
    for (const t of req.body.tools) {
      const name = String(t.name ?? t.function?.name ?? "").toLowerCase();
      const kind = /exec|code|python|shell/.test(name) ? "code_execution" : /http|fetch|web|network|email|post/.test(name) ? "network" : /file|read|write/.test(name) ? "file_access" : "tool";
      const rule = tools.find((p: any) => p.condition?.tool === kind && p.enabled);
      if (rule?.action === "BLOCK") return fail(403, "policy_blocked", `Tool "${name}" blocked by ${rule.name}.`, { policyId: rule.id });
      if (rule?.action === "REQUIRE APPROVAL") return fail(403, "approval_required", `Tool "${name}" requires approval (${rule.name}).`, { policyId: rule.id });
      toolNote += `${name}: allowed; `;
    }
  }
  step("Content Guardrail", decision === "REDACT" ? "WARN" : "PASS", decision === "REDACT" ? `DEMO POLICY DETECTION redacted ${findings.map((f) => f.detector).join(", ")}` : `No sensitive patterns${toolNote ? " · tools " + toolNote : ""}`);

  // --- Alias + route
  const { data: models } = await db.from("models").select("*").in("id", [aliasRow.primary_model, aliasRow.fallback_model].filter(Boolean));
  const { data: provs } = await db.from("providers").select("*");
  const primary = models?.find((m: any) => m.id === aliasRow.primary_model);
  const fallback = models?.find((m: any) => m.id === aliasRow.fallback_model);
  step("Alias Resolved", "PASS", `${alias} v${aliasRow.version} · ${aliasRow.strategy}`);

  const routable = (m: any) => {
    if (!m) return "missing";
    if (["Deprecated", "Disabled"].includes(m.status)) return `model ${m.status}`;
    if (m.status === "Under Review" && ctx.env !== "Sandbox") return "model under review (Sandbox only)";
    const p = provs?.find((x: any) => x.id === m.provider_id);
    if (dataClass === "RESTRICTED" && p?.external && !p?.restricted_ok) return "restricted data cannot reach external provider (DATA-004)";
    if (classRank(dataClass) > classRank(m.max_class)) return `model max class ${m.max_class}`;
    return null;
  };
  const candidates = [primary, aliasRow.strategy === "Fixed" ? null : fallback].filter(Boolean);
  const valid = candidates.filter((m: any) => !routable(m));
  if (!valid.length) return fail(503, "provider_unavailable", `No permitted route for ${alias}: ${routable(primary)}.`, { policyId: "DATA-004", retryable: true });
  step("Route Selected", "PASS", `Primary ${primary?.provider_model}${fallback ? ` · fallback ${fallback.provider_model}` : ""}`);

  // --- Provider call with failover
  const opts = { maxTokens: req.body?.max_output_tokens ?? req.body?.max_tokens ?? req.body?.max_completion_tokens, temperature: req.body?.temperature };
  let used: any = null;
  let usedFallback = false;
  let simulated = false;
  let iter: AsyncGenerator<Chunk> | null = null;
  let first: IteratorResult<Chunk> | null = null;
  const tCall = Date.now();

  if (req.endpoint === "embeddings") {
    const inputs: string[] = Array.isArray(req.body.input) ? req.body.input : [String(req.body.input ?? "")];
    const m = valid[0];
    const p = provs.find((x: any) => x.id === m.provider_id);
    let vectors: number[][] = [];
    let usage = Math.ceil(inputs.join(" ").length / 4);
    try {
      if (p.simulated_outage || p.status !== "enabled") throw new Error("unavailable");
      const k = process.env["LOVABLE_API_KEY"];
      if (p.id !== "lovable-ai" || !k) throw new Error("no creds");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: m.provider_model, input: inputs }) });
      if (!r.ok) throw new Error("upstream " + r.status);
      const j: any = await r.json();
      vectors = j.data.map((d: any) => d.embedding);
      usage = j.usage?.prompt_tokens ?? usage;
    } catch {
      simulated = true;
      vectors = inputs.map((s) => Array.from({ length: 16 }, (_, i) => ((hashNum(s + i) % 2000) - 1000) / 1000));
    }
    step("Provider Called", "PASS", `${m.provider_model}${simulated ? " · SIMULATED PROVIDER RESPONSE" : ""}`);
    step("First Token", "SKIP", "Not applicable to embeddings");
    step("Response Completed", "PASS", `${vectors.length} vector(s)`);
    await record({ m, p, usage: { input: usage, output: 0 }, ttft: 0, text: "", estimated: simulated });
    return {
      status: 200,
      headers,
      json: { object: "list", model: alias, data: vectors.map((e, i) => ({ object: "embedding", index: i, embedding: e })), usage: { prompt_tokens: usage, total_tokens: usage }, qgate: { request_id: reqId, simulated } },
    };
  }

  for (let i = 0; i < valid.length; i++) {
    const m = valid[i];
    const p = provs.find((x: any) => x.id === m.provider_id);
    try {
      const s = await providerStream(m, p, msgs, opts);
      iter = s.gen;
      first = await iter.next();
      used = m;
      simulated = s.simulated;
      usedFallback = i > 0;
      step("Provider Called", "PASS", `${p.name} · ${m.provider_model}${usedFallback ? " (FALLBACK)" : ""}${simulated ? " · SIMULATED" : ""}`);
      break;
    } catch (e: any) {
      step("Provider Called", "FAIL", `${p.name}: ${e.message}`);
      if (i + 1 < valid.length) {
        step("Circuit Breaker", "WARN", `Circuit OPEN for ${m.provider_model}; checking fallback policy`);
        step("Fallback Checked", "PASS", `Fallback ${valid[i + 1].provider_model} permitted for ${dataClass} · same request ${reqId}`);
      }
    }
  }
  if (!used || !iter) return fail(502, "provider_unavailable", "All permitted routes failed.", { retryable: true });
  const usedProvider = provs.find((x: any) => x.id === used.provider_id);
  if (usedFallback) headers["x-qgate-fallback"] = "true";
  if (simulated) headers["x-qgate-simulated"] = "true";

  async function record(r: { m: any; p: any; usage: { input: number; output: number } | null; ttft: number; text: string; estimated: boolean }) {
    const inTok = r.usage?.input ?? Math.ceil(all.length / 4);
    const outTok = r.usage?.output ?? Math.ceil(r.text.length / 4);
    const cost = (inTok * Number(r.m.input_price) + outTok * Number(r.m.output_price)) / 1e6;
    step("Usage Recorded", "PASS", `${inTok} in / ${outTok} out · $${cost.toFixed(6)}${r.estimated || !r.usage ? " · USAGE ESTIMATED" : " · provider-reported"}`);
    step("Audit Recorded", "PASS", `Trace ${reqId} persisted · logging ${ent.logging}`);
    const keepContent = ent.logging === "FULL CONTENT" || ent.logging === "REDACTED CONTENT";
    await db.from("traces").insert({
      id: reqId,
      user_name: ctx.user,
      team: project.team,
      project_name: project.name,
      key_prefix: ctx.keyPrefix,
      alias,
      provider: r.p.name + (usedFallback ? " (fallback)" : ""),
      model: r.m.provider_model,
      endpoint: ctx.endpoint,
      environment: ctx.env,
      input_tokens: inTok,
      output_tokens: outTok,
      cost,
      latency_ms: Date.now() - t0,
      ttft_ms: r.ttft,
      status: 200,
      policy_result: policyResult,
      fallback: usedFallback,
      simulated,
      usage_estimated: r.estimated || !r.usage,
      logging: ent.logging,
      steps,
      request_preview: keepContent ? redact(all, findings).slice(0, 2000) : null,
      response_preview: keepContent ? r.text.slice(0, 2000) : null,
    });
    if (key) await db.from("gateway_keys").update({ requests: Number(key.requests) + 1, tokens: Number(key.tokens) + inTok + outTok, spend: Number(key.spend) + cost, last_used: new Date().toISOString() }).eq("id", key.id);
    await db.from("entitlements").update({ spent_usd: Number(ent.spent_usd) + cost }).eq("id", ent.id);
    await db.from("projects").update({ spent_usd: Number(project.spent_usd) + cost }).eq("id", project.id);
    if (gov) await db.from("governance").update({ spent_usd: Number(gov.spent_usd) + cost }).eq("team", gov.team);
  }

  const stream = !!req.body?.stream;
  let ttft = 0;
  const firstChunk = first!;

  async function* allChunks(): AsyncGenerator<Chunk> {
    if (!firstChunk.done) yield firstChunk.value;
    for (;;) {
      const n = await iter!.next();
      if (n.done) return;
      yield n.value;
    }
  }

  const created = Math.floor(Date.now() / 1000);
  const meta = { request_id: reqId, alias, route: usedFallback ? "fallback" : "primary", simulated, policy_result: policyResult };

  if (!stream) {
    let text = "";
    let usage: { input: number; output: number } | null = null;
    for await (const c of allChunks()) {
      if (c.delta) {
        if (!ttft) {
          ttft = Date.now() - tCall;
          step("First Token", "PASS", `TTFT ${ttft}ms`);
        }
        text += c.delta;
      }
      if (c.usage) usage = c.usage;
    }
    step("Response Completed", "PASS", `${text.length} chars`);
    await record({ m: used, p: usedProvider, usage, ttft, text, estimated: false });
    const u = usage ?? { input: Math.ceil(all.length / 4), output: Math.ceil(text.length / 4) };
    let json: any;
    if (req.endpoint === "chat/completions")
      json = { id: "chatcmpl-" + reqId.slice(4), object: "chat.completion", created, model: alias, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: u.input, completion_tokens: u.output, total_tokens: u.input + u.output }, qgate: meta };
    else if (req.endpoint === "messages")
      json = { id: "msg_" + reqId.slice(4), type: "message", role: "assistant", model: alias, content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: u.input, output_tokens: u.output }, qgate: meta };
    else
      json = { id: "resp_" + reqId.slice(4), object: "response", created_at: created, status: "completed", model: alias, output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }], output_text: text, usage: { input_tokens: u.input, output_tokens: u.output, total_tokens: u.input + u.output }, qgate: meta };
    return { status: 200, headers, json };
  }

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (s: string) => controller.enqueue(enc.encode(s));
      let text = "";
      let usage: { input: number; output: number } | null = null;
      if (req.endpoint === "responses") push(sse("response.created", { type: "response.created", response: { id: "resp_" + reqId.slice(4), model: alias, status: "in_progress" }, qgate: meta }));
      if (req.endpoint === "messages") {
        push(sse("message_start", { type: "message_start", message: { id: "msg_" + reqId.slice(4), type: "message", role: "assistant", model: alias, content: [] }, qgate: meta }));
        push(sse("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }));
      }
      try {
        for await (const c of allChunks()) {
          if (c.delta) {
            if (!ttft) {
              ttft = Date.now() - tCall;
              step("First Token", "PASS", `TTFT ${ttft}ms (streamed)`);
            }
            text += c.delta;
            if (req.endpoint === "chat/completions") push(sse(null, { id: "chatcmpl-" + reqId.slice(4), object: "chat.completion.chunk", created, model: alias, choices: [{ index: 0, delta: { content: c.delta } }] }));
            else if (req.endpoint === "messages") push(sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: c.delta } }));
            else push(sse("response.output_text.delta", { type: "response.output_text.delta", delta: c.delta }));
          }
          if (c.usage) usage = c.usage;
        }
        step("Response Completed", "PASS", `Stream complete · ${text.length} chars`);
        await record({ m: used, p: usedProvider, usage, ttft, text, estimated: false });
        const u = usage ?? { input: Math.ceil(all.length / 4), output: Math.ceil(text.length / 4) };
        if (req.endpoint === "chat/completions") {
          push(sse(null, { id: "chatcmpl-" + reqId.slice(4), object: "chat.completion.chunk", created, model: alias, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: u.input, completion_tokens: u.output, total_tokens: u.input + u.output }, qgate: meta }));
          push(sse(null, "[DONE]"));
        } else if (req.endpoint === "messages") {
          push(sse("content_block_stop", { type: "content_block_stop", index: 0 }));
          push(sse("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { input_tokens: u.input, output_tokens: u.output } }));
          push(sse("message_stop", { type: "message_stop", qgate: meta }));
        } else {
          push(sse("response.completed", { type: "response.completed", response: { id: "resp_" + reqId.slice(4), status: "completed", model: alias, output_text: text, usage: { input_tokens: u.input, output_tokens: u.output } }, qgate: meta }));
        }
      } catch (e: any) {
        push(sse("error", { error: { type: "streaming_error", message: e.message, request_id: reqId, retryable: true } }));
      }
      controller.close();
    },
  });
  return { status: 200, headers: { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache" }, stream: body };
}

export async function listModelsForKey(raw: string) {
  const hash = await sha256(raw);
  const { data: key } = await db.from("gateway_keys").select("*").eq("key_hash", hash).maybeSingle();
  if (!key || key.status !== "active" || (key.expires_at && new Date(key.expires_at) < new Date())) return null;
  if (!(key.scopes ?? []).includes("models:read")) return null;
  const { data: project } = await db.from("projects").select("*").eq("id", key.project_id).maybeSingle();
  const { data: ents } = await db.from("entitlements").select("*").eq("project_id", key.project_id).eq("status", "active").eq("environment", key.environment);
  const { data: matrix } = await db.from("matrix").select("*").eq("team", project?.team ?? "");
  const allowed = (key.aliases as string[]).filter((a) => {
    const e = (ents ?? []).find((x: any) => x.alias === a && (!x.expires_at || new Date(x.expires_at) > new Date()));
    if (!e) return false;
    const m = (matrix ?? []).find((x: any) => x.alias === a && x.environment === key.environment) ?? (matrix ?? []).find((x: any) => x.alias === a && x.environment === "*");
    return m?.state === "ALLOWED" || (m?.state === "APPROVAL REQUIRED" && e.exception);
  });
  return { object: "list", data: allowed.map((id) => ({ id, object: "model", owned_by: "q-gate", created: 1767225600 })) };
}
