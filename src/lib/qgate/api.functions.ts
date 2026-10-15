/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { permissionsFor, type Permission, ROLES } from "./constants";
import { evaluatePreflight } from "./preflight";
import { scanText, decide, redact } from "./dlp";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function ctx(need?: Permission) {
  const { getSessionUser } = await import("@/lib/auth.server");
  const u = await getSessionUser();
  if (!u) throw new Error("Sign in to Lovable to use Q-GATE AI.");
  const db = await admin();
  const name = u.displayName || u.email || "User";
  await db.from("app_users").upsert({ id: u.userId, email: u.email, display_name: name }, { onConflict: "id" });
  let { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.userId);
  if (!roles?.length) {
    const { count } = await db.from("user_roles").select("*", { count: "exact", head: true });
    const grant = count ? ["developer"] : ["org_admin", "developer"];
    await db.from("user_roles").insert(grant.map((role) => ({ user_id: u.userId, role })));
    roles = grant.map((role) => ({ role }));
  }
  const roleList = roles!.map((r: any) => r.role);
  const perms = permissionsFor(roleList);
  if (need && !perms.includes(need)) throw new Error(`Forbidden: requires ${need} permission.`);
  const { data: profile } = await db.from("app_users").select("*").eq("id", u.userId).single();
  return { db, user: { id: u.userId, name, email: u.email, team: profile.team, bu: profile.business_unit }, roles: roleList, perms };
}

async function audit(db: any, actor: string, action: string, resource: string, prev: any, next: any, reason?: string, request_id?: string) {
  await db.from("audit_events").insert({ actor, action, resource, prev_value: prev == null ? null : String(prev), new_value: next == null ? null : String(next), reason, request_id });
}

const v = <T,>() => (d: T) => d;

/* ---------- identity ---------- */
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const c = await ctx();
    return { user: c.user, roles: c.roles, perms: c.perms };
  } catch (e: any) {
    return { user: null, roles: [], perms: [], error: e.message as string };
  }
});

export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator(v<{ team: string; bu: string }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    await c.db.from("app_users").update({ team: data.team, business_unit: data.bu }).eq("id", c.user.id);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx("view_audit");
  const { data: users } = await c.db.from("app_users").select("*").order("created_at");
  const { data: roles } = await c.db.from("user_roles").select("*");
  return (users ?? []).map((u: any) => ({ ...u, roles: (roles ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role) }));
});

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator(v<{ userId: string; role: string; on: boolean }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_users");
    if (!(data.role in ROLES)) throw new Error("Unknown role");
    if (data.on) await c.db.from("user_roles").upsert({ user_id: data.userId, role: data.role });
    else await c.db.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    await audit(c.db, c.user.name, data.on ? "Role Granted" : "Role Removed", `user:${data.userId}`, null, data.role);
    return { ok: true };
  });

/* ---------- command center ---------- */
export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const db = c.db;
  const [{ data: traces }, { data: gov }, { data: providers }, { data: alerts }, { count: keyCount }, { data: aliases }, { count: pending }] = await Promise.all([
    db.from("traces").select("created_at,team,alias,provider,status,latency_ms,input_tokens,output_tokens,cost,fallback,error_code,project_name").order("created_at", { ascending: false }).limit(1000),
    db.from("governance").select("*"),
    db.from("providers").select("*"),
    db.from("alerts").select("*").eq("status", "open"),
    db.from("gateway_keys").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("aliases").select("*"),
    db.from("access_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return { traces: traces ?? [], gov: gov ?? [], providers: providers ?? [], openAlerts: alerts?.length ?? 0, activeKeys: keyCount ?? 0, aliases: aliases ?? [], pending: pending ?? 0 };
});

/* ---------- projects ---------- */
export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data } = await c.db.from("projects").select("*").order("created_at", { ascending: false });
  return { mine: (data ?? []).filter((p: any) => p.owner_id === c.user.id), all: data ?? [] };
});

export const createProject = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    if (!data.name?.trim()) throw new Error("Project name required");
    const row = {
      name: String(data.name).slice(0, 80),
      team: data.team,
      business_unit: data.business_unit,
      owner_id: c.user.id,
      owner_name: data.owner || c.user.name,
      environment: data.environment,
      use_case: data.use_case,
      data_class: data.data_class,
      expected_requests: Number(data.expected_requests) || 0,
      expected_tokens: Number(data.expected_tokens) || 0,
      cost_center: data.cost_center,
      app_name: data.app_name,
      description: data.description,
      budget_usd: 2000,
    };
    const { data: p, error } = await c.db.from("projects").insert(row).select().single();
    if (error) throw new Error(error.message);
    await c.db.from("app_users").update({ team: data.team, business_unit: data.business_unit }).eq("id", c.user.id);
    await audit(c.db, c.user.name, "Project Created", `project:${p.name}`, null, `${p.environment}/${p.data_class}`);
    return p;
  });

/* ---------- catalog ---------- */
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const [{ data: aliases }, { data: models }, { data: providers }, { data: versions }, { data: pricing }] = await Promise.all([
    c.db.from("aliases").select("*").order("alias"),
    c.db.from("models").select("*").order("id"),
    c.db.from("providers").select("id,name,kind,base_url,auth,region,status,external,restricted_ok,simulated_outage,secret_last4,secret_status,pending_secret_last4,secret_rotated_at,latency_ms,error_rate"),
    c.db.from("alias_versions").select("*").order("version", { ascending: false }),
    c.db.from("pricing").select("*"),
  ]);
  const { data: tr } = await c.db.from("traces").select("provider,status").limit(1000);
  return { aliases, models, providers, versions, pricing, traffic: tr ?? [] };
});

export const updateAliasRoute = createServerFn({ method: "POST" })
  .inputValidator(v<{ alias: string; primary_model: string; fallback_model: string | null; strategy: string; latency_ms?: number; retries?: number; note: string; environments?: string[]; max_class?: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const { data: cur } = await c.db.from("aliases").select("*").eq("alias", data.alias).single();
    const version = cur.version + 1;
    await c.db.from("alias_versions").update({ status: "superseded" }).eq("alias", data.alias).eq("status", "active");
    await c.db.from("alias_versions").insert({ alias: data.alias, version, primary_model: data.primary_model, fallback_model: data.fallback_model || null, strategy: data.strategy, note: data.note, created_by: c.user.name });
    await c.db
      .from("aliases")
      .update({ version, primary_model: data.primary_model, fallback_model: data.fallback_model || null, strategy: data.strategy, latency_ms: data.latency_ms ?? cur.latency_ms, retries: data.retries ?? cur.retries, environments: data.environments ?? cur.environments, max_class: data.max_class ?? cur.max_class, updated_at: new Date().toISOString() })
      .eq("alias", data.alias);
    await audit(c.db, c.user.name, "Alias Changed", `alias:${data.alias}`, `v${cur.version} ${cur.primary_model}`, `v${version} ${data.primary_model}`, data.note);
    return { version };
  });

export const rollbackAlias = createServerFn({ method: "POST" })
  .inputValidator(v<{ alias: string; version: number }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const { data: ver } = await c.db.from("alias_versions").select("*").eq("alias", data.alias).eq("version", data.version).single();
    const { data: cur } = await c.db.from("aliases").select("*").eq("alias", data.alias).single();
    const version = cur.version + 1;
    await c.db.from("alias_versions").update({ status: "superseded" }).eq("alias", data.alias).eq("status", "active");
    await c.db.from("alias_versions").insert({ alias: data.alias, version, primary_model: ver.primary_model, fallback_model: ver.fallback_model, strategy: ver.strategy, note: `Rollback to v${data.version}`, created_by: c.user.name });
    await c.db.from("aliases").update({ version, primary_model: ver.primary_model, fallback_model: ver.fallback_model, strategy: ver.strategy, updated_at: new Date().toISOString() }).eq("alias", data.alias);
    await audit(c.db, c.user.name, "Alias Rolled Back", `alias:${data.alias}`, `v${cur.version}`, `v${version} (=v${data.version})`);
    return { version };
  });

export const registerModel = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const row = {
      id: "m-" + String(data.provider_model).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40),
      provider_id: data.provider_id,
      provider_model: data.provider_model,
      capabilities: String(data.capabilities || "chat").split(",").map((s: string) => s.trim()),
      max_class: data.max_class || "INTERNAL",
      region: data.region,
      context_window: Number(data.context_window) || 128000,
      input_price: Number(data.input_price) || 0,
      output_price: Number(data.output_price) || 0,
      status: "Under Review",
    };
    const { error } = await c.db.from("models").insert(row);
    if (error) throw new Error(error.message);
    await c.db.from("pricing").insert({ provider: row.provider_id, model: row.provider_model, input_price: row.input_price, output_price: row.output_price, cached_price: 0 });
    await audit(c.db, c.user.name, "Model Registered", `model:${row.id}`, null, "Under Review");
    return row;
  });

export const setModelStatus = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; status: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const { data: m } = await c.db.from("models").select("status").eq("id", data.id).single();
    await c.db.from("models").update({ status: data.status }).eq("id", data.id);
    await audit(c.db, c.user.name, data.status === "Approved" ? "Model Approved" : "Model Status Changed", `model:${data.id}`, m?.status, data.status);
    return { ok: true };
  });

export const setModelOutage = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; on: boolean }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const { data: m } = await c.db.from("models").select("provider_model").eq("id", data.id).single();
    await c.db.from("models").update({ simulated_outage: data.on }).eq("id", data.id);
    await audit(c.db, c.user.name, "Provider Health Simulation", `model:${data.id}`, !data.on, data.on);
    if (data.on) await c.db.from("alerts").insert({ type: "Provider Outage", severity: "critical", title: `${m.provider_model} route unhealthy (simulated)`, detail: "Circuit breaker opens; fallback routes engaged where policy permits." });
    return { ok: true };
  });

/* ---------- providers ---------- */
export const upsertProvider = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const id = String(data.id || data.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await c.db.from("providers").upsert({ id, name: data.name, kind: data.kind, base_url: data.base_url, auth: data.auth, region: data.region, external: data.external !== false, restricted_ok: !!data.restricted_ok });
    if (error) throw new Error(error.message);
    await audit(c.db, c.user.name, "Provider Registered", `provider:${id}`, null, data.kind);
    return { id };
  });

export const providerAction = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; action: "enable" | "disable" | "outage_on" | "outage_off" | "set_secret" | "activate_secret" | "retire_secret" | "test"; secret?: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_models");
    const { data: p } = await c.db.from("providers").select("*").eq("id", data.id).single();
    const up = (o: any) => c.db.from("providers").update(o).eq("id", data.id);
    switch (data.action) {
      case "enable":
      case "disable":
        await up({ status: data.action === "enable" ? "enabled" : "disabled" });
        await audit(c.db, c.user.name, data.action === "disable" ? "Provider Disabled" : "Provider Enabled", `provider:${data.id}`, p.status, data.action + "d");
        return { ok: true };
      case "outage_on":
      case "outage_off":
        await up({ simulated_outage: data.action === "outage_on" });
        await audit(c.db, c.user.name, "Provider Health Simulation", `provider:${data.id}`, p.simulated_outage, data.action === "outage_on");
        if (data.action === "outage_on") await c.db.from("alerts").insert({ type: "Provider Outage", severity: "critical", title: `${p.name} unhealthy (simulated)`, detail: "Circuit breaker will open; fallback routes engaged where permitted." });
        return { ok: true };
      case "set_secret": {
        const s = String(data.secret ?? "").trim();
        if (s.length < 8) throw new Error("Secret too short");
        await c.db.from("provider_secrets").upsert({ provider_id: data.id, slot: "pending", secret: s });
        await up({ pending_secret_last4: "••" + s.slice(-4) });
        await audit(c.db, c.user.name, "Provider Secret Added", `provider:${data.id}`, null, "pending (value never returned)");
        return { ok: true };
      }
      case "test": {
        const { data: sec } = await c.db.from("provider_secrets").select("*").eq("provider_id", data.id).in("slot", ["pending", "active"]);
        if (data.id === "lovable-ai") return { ok: !!process.env["LOVABLE_API_KEY"], detail: "Managed server-side credential present" };
        if (data.id === "demo") return { ok: true, detail: "Simulator healthy" };
        const s = (sec ?? []).find((x: any) => x.slot === "pending") ?? (sec ?? [])[0];
        if (!s) return { ok: false, detail: "No secret configured — requests use Demo Provider (SIMULATED)." };
        try {
          const url = p.base_url.replace(/\/$/, "") + "/models";
          const r = await fetch(url, { headers: p.kind === "Anthropic" ? { "x-api-key": s.secret, "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${s.secret}` } });
          return { ok: r.ok, detail: `GET /models → ${r.status}` };
        } catch (e: any) {
          return { ok: false, detail: e.message };
        }
      }
      case "activate_secret": {
        const { data: pend } = await c.db.from("provider_secrets").select("*").eq("provider_id", data.id).eq("slot", "pending").maybeSingle();
        if (!pend) throw new Error("No pending secret");
        const { data: act } = await c.db.from("provider_secrets").select("*").eq("provider_id", data.id).eq("slot", "active").maybeSingle();
        if (act) await c.db.from("provider_secrets").upsert({ provider_id: data.id, slot: "previous", secret: act.secret });
        await c.db.from("provider_secrets").upsert({ provider_id: data.id, slot: "active", secret: pend.secret });
        await c.db.from("provider_secrets").delete().eq("provider_id", data.id).eq("slot", "pending");
        await up({ secret_last4: p.pending_secret_last4, pending_secret_last4: null, secret_status: act ? "active (previous retained)" : "active", secret_rotated_at: new Date().toISOString() });
        await audit(c.db, c.user.name, "Provider Secret Activated", `provider:${data.id}`, p.secret_last4, p.pending_secret_last4);
        return { ok: true };
      }
      case "retire_secret":
        await c.db.from("provider_secrets").delete().eq("provider_id", data.id).eq("slot", "previous");
        await up({ secret_status: "active" });
        await audit(c.db, c.user.name, "Provider Secret Retired", `provider:${data.id}`, "previous", "deleted");
        return { ok: true };
    }
  });

/* ---------- access requests & approvals ---------- */
async function preflightFor(db: any, roles: string[], project: any, alias: string, environment: string, dataClass: string, spend: number) {
  const { data: a } = await db.from("aliases").select("*").eq("alias", alias).single();
  const { data: m } = await db.from("matrix").select("*").eq("team", project.team).eq("alias", alias);
  const state = (m ?? []).find((x: any) => x.environment === environment)?.state ?? (m ?? []).find((x: any) => x.environment === "*")?.state ?? "APPROVAL REQUIRED";
  const { data: gov } = await db.from("governance").select("*").eq("team", project.team).maybeSingle();
  return evaluatePreflight({
    userRoles: roles,
    matrixState: state,
    projectStatus: project.status,
    environment,
    aliasEnvironments: a.environments,
    dataClass,
    aliasMaxClass: a.max_class,
    expectedSpend: spend,
    teamBudget: Number(gov?.budget_usd ?? 5000),
    teamSpent: Number(gov?.spent_usd ?? 0),
  });
}

async function createEntitlement(db: any, req: any, cond: any, decidedBy: string) {
  const days = Number(cond?.expiry_days ?? req.duration_days ?? 90);
  const { data: e } = await db
    .from("entitlements")
    .insert({
      project_id: req.project_id,
      alias: cond?.alias ?? req.alias,
      environment: cond?.environment ?? req.environment,
      max_class: cond?.max_class ?? req.data_class,
      monthly_budget: Number(cond?.monthly_budget ?? Math.max(500, req.expected_spend)),
      rpm: Number(cond?.rpm ?? 100),
      tpm: Number(cond?.tpm ?? 100000),
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      logging: cond?.logging ?? "METADATA ONLY",
      endpoints: cond?.endpoints ?? ["responses", "chat", "messages", "embeddings", "models"],
      exception: req.outcome !== "AUTO APPROVABLE",
      request_id: req.id,
    })
    .select()
    .single();
  await audit(db, decidedBy, "Access Granted", `entitlement:${req.alias}`, null, `${e.environment} · ${e.max_class} · $${e.monthly_budget} · ${days}d`, req.justification, undefined);
  return e;
}

export const previewAccess = createServerFn({ method: "POST" })
  .inputValidator(v<{ project_id: string; alias: string; environment: string; data_class: string; expected_spend: number }>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    const { data: p } = await c.db.from("projects").select("*").eq("id", data.project_id).single();
    return preflightFor(c.db, c.roles, p, data.alias, data.environment, data.data_class, Number(data.expected_spend) || 0);
  });

export const submitAccessRequest = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    const { data: p } = await c.db.from("projects").select("*").eq("id", data.project_id).single();
    if (p.owner_id !== c.user.id && !c.perms.includes("approve") && !p.seeded) throw new Error("You can only request access for your own projects.");
    const pf = await preflightFor(c.db, c.roles, p, data.alias, data.environment, data.data_class, Number(data.expected_spend) || 0);
    const row = {
      project_id: p.id,
      requester_id: c.user.id,
      requester_name: c.user.name,
      team: p.team,
      business_unit: p.business_unit,
      kind: data.kind || (data.environment === "Production" ? "Production Access" : "Model Access"),
      alias: data.alias,
      use_case: data.use_case,
      environment: data.environment,
      data_class: data.data_class,
      expected_tokens: Number(data.expected_tokens) || 0,
      expected_spend: Number(data.expected_spend) || 0,
      duration_days: Number(data.duration_days) || 90,
      justification: data.justification,
      preflight: pf.checks,
      outcome: pf.outcome,
      status: pf.outcome === "AUTO APPROVABLE" ? "approved" : pf.outcome === "DENIED" ? "rejected" : "pending",
      decided_by: pf.outcome === "AUTO APPROVABLE" ? "Policy engine (auto)" : pf.outcome === "DENIED" ? "Policy engine (auto)" : null,
      decided_at: pf.outcome === "AUTO APPROVABLE" || pf.outcome === "DENIED" ? new Date().toISOString() : null,
    };
    const { data: r, error } = await c.db.from("access_requests").insert(row).select().single();
    if (error) throw new Error(error.message);
    let entitlement = null;
    if (pf.outcome === "AUTO APPROVABLE") entitlement = await createEntitlement(c.db, r, { logging: p.data_class === "RESTRICTED" ? "NO CONTENT RETENTION" : "METADATA ONLY", monthly_budget: 500 }, "Policy engine (auto)");
    await audit(c.db, c.user.name, "Access Requested", `alias:${data.alias}`, null, pf.outcome, data.justification);
    return { request: r, preflight: pf, entitlement };
  });

export const listRequests = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data } = await c.db.from("access_requests").select("*, projects(name, budget_usd, spent_usd)").order("created_at", { ascending: false }).limit(200);
  const { data: gov } = await c.db.from("governance").select("team,budget_usd,spent_usd");
  return { requests: data ?? [], gov: gov ?? [], canApprove: c.perms.includes("approve") };
});

export const decideRequest = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; action: "approve" | "approve_conditions" | "reject" | "request_info"; conditions?: any; note?: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("approve");
    const { data: r } = await c.db.from("access_requests").select("*").eq("id", data.id).single();
    if (r.status !== "pending" && r.status !== "info_requested") throw new Error("Request already decided");
    if (r.data_class === "RESTRICTED" && !c.perms.includes("manage_policies") && data.action.startsWith("approve")) throw new Error("Restricted data requests need Security Admin approval.");
    const status = data.action === "reject" ? "rejected" : data.action === "request_info" ? "info_requested" : "approved";
    await c.db.from("access_requests").update({ status, conditions: data.conditions ?? null, decided_by: c.user.name, decided_at: new Date().toISOString(), note: data.note }).eq("id", data.id);
    let e = null;
    if (status === "approved" && r.project_id) e = await createEntitlement(c.db, r, data.action === "approve_conditions" ? data.conditions : null, c.user.name);
    await audit(c.db, c.user.name, status === "approved" ? "Request Approved" : status === "rejected" ? "Request Rejected" : "Information Requested", `request:${r.alias}`, "pending", status, data.note);
    return { status, entitlement: e };
  });

/* ---------- my access & keys ---------- */
export const getMyAccess = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data: projects } = await c.db.from("projects").select("*").eq("owner_id", c.user.id);
  const ids = (projects ?? []).map((p: any) => p.id);
  if (!ids.length) return { projects: [], entitlements: [], keys: [], requests: [] };
  const [{ data: ents }, { data: keys }, { data: reqs }] = await Promise.all([
    c.db.from("entitlements").select("*").in("project_id", ids).order("created_at", { ascending: false }),
    c.db.from("gateway_keys").select("id,name,prefix,last4,project_id,owner_name,kind,environment,aliases,scopes,budget,rpm,expires_at,status,requests,tokens,spend,last_used,created_at").in("project_id", ids).order("created_at", { ascending: false }),
    c.db.from("access_requests").select("*").in("project_id", ids).order("created_at", { ascending: false }),
  ]);
  return { projects, entitlements: ents ?? [], keys: keys ?? [], requests: reqs ?? [] };
});

async function mintKey(env: string) {
  const { sha256, randHex } = await import("./gateway.server");
  const prefix = env === "Production" ? "qzg_live_" : "qzg_test_";
  const raw = prefix + randHex(32);
  return { raw, prefix, last4: raw.slice(-4).toUpperCase(), hash: await sha256(raw) };
}

export const createKey = createServerFn({ method: "POST" })
  .inputValidator(v<{ project_id: string; name: string; environment: string; aliases: string[]; scopes: string[]; budget: number; rpm: number; expiry_days: number; kind?: string; owner?: string; live?: boolean }>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    const { data: p } = await c.db.from("projects").select("*").eq("id", data.project_id).single();
    if (p.owner_id !== c.user.id && !c.perms.includes("approve")) throw new Error("You can only create keys for your own projects.");
    const { data: ents } = await c.db.from("entitlements").select("alias").eq("project_id", p.id).eq("status", "active").eq("environment", data.environment);
    const entitled = new Set((ents ?? []).map((e: any) => e.alias));
    const aliases = data.aliases.filter((a) => entitled.has(a));
    if (!aliases.length) throw new Error("No active entitlement for the selected aliases in this environment.");
    const scopes = data.scopes.filter((s) => ["responses:write", "chat:write", "messages:write", "embeddings:write", "models:read", "usage:read"].includes(s));
    const k = await mintKey(data.live || data.environment === "Production" ? "Production" : data.environment);
    const { data: row, error } = await c.db
      .from("gateway_keys")
      .insert({ name: data.name, prefix: k.prefix, last4: k.last4, key_hash: k.hash, project_id: p.id, owner_id: c.user.id, owner_name: data.owner || c.user.name, kind: data.kind || "human", environment: data.environment, aliases, scopes, budget: data.budget, rpm: data.rpm, expires_at: new Date(Date.now() + data.expiry_days * 86400000).toISOString() })
      .select("id,name,prefix,last4")
      .single();
    if (error) throw new Error(error.message);
    await audit(c.db, c.user.name, "Key Created", `key:${data.name}`, null, `${k.prefix}••••${k.last4}`);
    return { ...row, plaintext: k.raw };
  });

export const listKeys = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data } = await c.db.from("gateway_keys").select("id,name,prefix,last4,project_id,owner_id,owner_name,kind,environment,aliases,scopes,budget,rpm,expires_at,status,requests,tokens,spend,last_used,created_at, projects(name)").order("created_at", { ascending: false });
  return { keys: data ?? [], me: c.user.id, isAdmin: c.perms.includes("approve") };
});

export const keyAction = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; action: "rotate" | "disable" | "enable" | "revoke" | "extend" | "budget"; value?: number }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    const { data: k } = await c.db.from("gateway_keys").select("*").eq("id", data.id).single();
    if (k.owner_id !== c.user.id && !c.perms.includes("approve")) throw new Error("Forbidden: not your key.");
    if (k.status === "revoked") throw new Error("Revoked keys cannot be changed.");
    const up = (o: any) => c.db.from("gateway_keys").update(o).eq("id", data.id);
    if (data.action === "rotate") {
      const n = await mintKey(k.prefix === "qzg_live_" ? "Production" : "Test");
      await up({ key_hash: n.hash, last4: n.last4, prefix: n.prefix });
      await audit(c.db, c.user.name, "Key Rotated", `key:${k.name}`, `••••${k.last4}`, `••••${n.last4}`);
      return { plaintext: n.raw };
    }
    if (data.action === "extend") await up({ expires_at: new Date(Math.max(Date.now(), new Date(k.expires_at).getTime()) + (data.value ?? 30) * 86400000).toISOString() });
    else if (data.action === "budget") await up({ budget: data.value });
    else await up({ status: data.action === "enable" ? "active" : data.action === "disable" ? "disabled" : "revoked" });
    await audit(c.db, c.user.name, data.action === "revoke" ? "Key Revoked" : data.action === "budget" ? "Budget Changed" : `Key ${data.action}`, `key:${k.name}`, data.action === "budget" ? k.budget : k.status, data.value ?? data.action);
    return { ok: true };
  });

/* ---------- governance ---------- */
export const getGovernance = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const [{ data: matrix }, { data: gov }, { data: policies }] = await Promise.all([c.db.from("matrix").select("*"), c.db.from("governance").select("*").order("team"), c.db.from("policies").select("*").order("id")]);
  return { matrix: matrix ?? [], gov: gov ?? [], policies: policies ?? [], perms: c.perms };
});

export const setMatrix = createServerFn({ method: "POST" })
  .inputValidator(v<{ team: string; alias: string; environment: string; state: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_policies").catch(() => ctx("manage_models"));
    const { data: prev } = await c.db.from("matrix").select("state").eq("team", data.team).eq("alias", data.alias).eq("environment", data.environment).maybeSingle();
    await c.db.from("matrix").upsert(data);
    await audit(c.db, c.user.name, "Entitlement Policy Changed", `matrix:${data.team}/${data.alias}/${data.environment}`, prev?.state ?? "(inherits *)", data.state);
    return { ok: true };
  });

export const setGovernance = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_finops").catch(() => ctx("manage_policies"));
    const { data: prev } = await c.db.from("governance").select("*").eq("team", data.team).single();
    const patch: any = {};
    for (const k of ["environment", "data_class", "aliases", "budget_usd", "rpm", "tpm", "logging", "key_expiry_days", "enforcement", "spent_usd"]) if (data[k] !== undefined) patch[k] = data[k];
    await c.db.from("governance").update(patch).eq("team", data.team);
    await audit(c.db, c.user.name, "Budget Changed", `governance:${data.team}`, JSON.stringify(Object.fromEntries(Object.keys(patch).map((k) => [k, prev[k]]))), JSON.stringify(patch));
    return { ok: true };
  });

export const savePolicy = createServerFn({ method: "POST" })
  .inputValidator(v<any>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_policies");
    const id = data.id || `CUS-${String(Date.now()).slice(-5)}`;
    const { data: prev } = await c.db.from("policies").select("*").eq("id", id).maybeSingle();
    await c.db.from("policies").upsert({ id, name: data.name, layer: data.layer, description: data.description, condition: data.condition, action: data.action, enabled: data.enabled ?? true, origin: data.origin ?? "Organization", updated_at: new Date().toISOString() });
    await audit(c.db, c.user.name, prev ? "Policy Updated" : "Policy Created", `policy:${id}`, prev ? `${prev.action}/${prev.enabled}` : null, `${data.action}/${data.enabled ?? true}`);
    return { id };
  });

export const testContent = createServerFn({ method: "POST" })
  .inputValidator(v<{ text: string }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    const { data: pol } = await c.db.from("policies").select("*").eq("layer", "Content");
    const f = scanText(data.text, pol ?? []);
    return { findings: f, decision: decide(f), sanitized: redact(data.text, f) };
  });

/* ---------- route simulator ---------- */
export const simulateRoute = createServerFn({ method: "POST" })
  .inputValidator(v<{ team: string; project_id?: string; environment: string; data_class: string; alias: string; tokens: number }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    const db = c.db;
    const { classRank } = await import("./constants");
    const checks: { n: string; r: string; d: string }[] = [];
    const add = (n: string, r: string, d: string) => checks.push({ n, r, d });
    add("Identity", "PASS", `${c.user.name} (${c.roles.join(", ")})`);
    let project: any = null;
    if (data.project_id) project = (await db.from("projects").select("*").eq("id", data.project_id).single()).data;
    const { data: mrows } = await db.from("matrix").select("*").eq("team", data.team).eq("alias", data.alias);
    const state = (mrows ?? []).find((m: any) => m.environment === data.environment)?.state ?? (mrows ?? []).find((m: any) => m.environment === "*")?.state;
    let entOk = state === "ALLOWED";
    let entDetail = `Matrix ${state}`;
    if (project) {
      const { data: e } = await db.from("entitlements").select("*").eq("project_id", project.id).eq("alias", data.alias).eq("environment", data.environment).eq("status", "active");
      entOk = !!e?.length && (state === "ALLOWED" || (state === "APPROVAL REQUIRED" && e.some((x: any) => x.exception)));
      entDetail += e?.length ? " · project entitlement active" : " · no project entitlement";
    }
    add("Entitlement", state === "DENIED" ? "FAIL" : entOk ? "PASS" : "REVIEW", entDetail);
    const { data: a } = await db.from("aliases").select("*").eq("alias", data.alias).single();
    add("Environment", a.environments.includes(data.environment) ? "PASS" : "FAIL", `${data.alias} approved for ${a.environments.join(", ")}`);
    add("Data Policy", classRank(data.data_class) <= classRank(a.max_class) ? "PASS" : "FAIL", `${data.data_class} vs alias max ${a.max_class}`);
    const { data: gov } = await db.from("governance").select("*").eq("team", data.team).maybeSingle();
    const pct = gov ? (Number(gov.spent_usd) / Number(gov.budget_usd)) * 100 : 0;
    add("Budget", pct >= 100 ? "FAIL" : pct >= 90 ? "WARN" : "PASS", `${data.team} at ${pct.toFixed(1)}% (${gov?.enforcement ?? "Alert"} at ≥90%)`);
    add("Rate Limit", data.tokens > (gov?.tpm ?? 1e9) ? "FAIL" : "PASS", `${data.tokens} tokens vs TPM ${gov?.tpm ?? "n/a"}`);
    const { data: models } = await db.from("models").select("*").in("id", [a.primary_model, a.fallback_model].filter(Boolean));
    const { data: provs } = await db.from("providers").select("*");
    const desc = (id: string) => {
      const m = models?.find((x: any) => x.id === id);
      if (!m) return null;
      const p = provs.find((x: any) => x.id === m.provider_id);
      const blocked = data.data_class === "RESTRICTED" && p.external && !p.restricted_ok;
      return { model: m.provider_model, provider: p.name, healthy: !p.simulated_outage && !m.simulated_outage && p.status === "enabled", blocked, status: m.status, cost: ((data.tokens * Number(m.input_price)) / 1e6).toFixed(5) };
    };
    const primary = desc(a.primary_model);
    const fallback = a.fallback_model ? desc(a.fallback_model) : null;
    const selected = primary && primary.healthy && !primary.blocked ? "primary" : fallback && fallback.healthy && !fallback.blocked ? "fallback" : "none";
    const loggingMode = data.data_class === "RESTRICTED" ? "NO CONTENT RETENTION" : gov?.logging ?? "METADATA ONLY";
    const allowed = checks.every((x) => x.r === "PASS" || x.r === "WARN") && selected !== "none";
    const why = allowed
      ? `${data.team} is ${state} for ${data.alias} in ${data.environment}; ${data.data_class} is within the alias ceiling; budget at ${pct.toFixed(0)}%. Strategy "${a.strategy}" selects the ${selected} route${selected === "fallback" ? " because the primary is unhealthy or blocked for this data class" : ""}.`
      : `Request would be blocked: ${checks.filter((x) => x.r === "FAIL" || x.r === "REVIEW").map((x) => `${x.n} (${x.d})`).join("; ") || "no permitted healthy route"}.`;
    return { checks, alias: data.alias, version: a.version, strategy: a.strategy, primary, fallback, selected, logging: loggingMode, allowed, why };
  });

/* ---------- playground / evaluation ---------- */
export const runPlayground = createServerFn({ method: "POST" })
  .inputValidator(v<{ project_id: string; alias: string; system?: string; prompt: string; max_output?: number; temperature?: number; tools?: boolean; structured?: boolean }>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    const { runGateway } = await import("./gateway.server");
    const t = Date.now();
    const body: any = {
      model: data.alias,
      instructions: [data.system, data.structured ? "Respond ONLY with a valid JSON object." : ""].filter(Boolean).join("\n") || undefined,
      input: data.prompt,
      max_output_tokens: data.max_output,
      temperature: data.temperature,
      tools: data.tools ? [{ type: "function", name: "lookup_customer", description: "Look up a customer record", parameters: { type: "object", properties: {} } }] : undefined,
    };
    const r = await runGateway({ endpoint: "responses", body, auth: { kind: "console", actor: c.user.name, projectId: data.project_id } });
    const id = r.headers["x-qgate-request-id"];
    const { data: trace } = await c.db.from("traces").select("*").eq("id", id).maybeSingle();
    let jsonValid: boolean | null = null;
    if (data.structured && r.json?.output_text) {
      try {
        JSON.parse(r.json.output_text.replace(/^```json\s*|```$/g, "").trim());
        jsonValid = true;
      } catch {
        jsonValid = false;
      }
    }
    return { status: r.status, response: r.json, trace, wall: Date.now() - t, jsonValid };
  });

export const listEvalSets = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data } = await c.db.from("eval_sets").select("*").order("created_at");
  return data ?? [];
});

export const saveEvalSet = createServerFn({ method: "POST" })
  .inputValidator(v<{ id?: string; name: string; category: string; project: string; prompts: string[]; criteria: string; last_run?: any }>())
  .handler(async ({ data }) => {
    const c = await ctx("build");
    const row: any = { name: data.name, category: data.category, project: data.project, prompts: data.prompts, criteria: data.criteria, owner: c.user.name };
    if (data.last_run) row.last_run = data.last_run;
    if (data.id) await c.db.from("eval_sets").update(row).eq("id", data.id);
    else await c.db.from("eval_sets").insert(row);
    return { ok: true };
  });

/* ---------- observability ---------- */
export const listTraces = createServerFn({ method: "POST" })
  .inputValidator(v<{ q?: string; status?: string; alias?: string; limit?: number }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    let q = c.db.from("traces").select("id,created_at,user_name,team,project_name,key_prefix,alias,provider,model,endpoint,environment,input_tokens,output_tokens,cost,latency_ms,ttft_ms,status,error_code,policy_id,policy_result,fallback,simulated,usage_estimated").order("created_at", { ascending: false }).limit(data.limit ?? 500);
    if (data.q) q = q.or(`id.ilike.%${data.q.replace(/[,%]/g, "")}%,user_name.ilike.%${data.q.replace(/[,%]/g, "")}%,project_name.ilike.%${data.q.replace(/[,%]/g, "")}%`);
    if (data.status === "ok") q = q.eq("status", 200);
    if (data.status === "error") q = q.neq("status", 200);
    if (data.alias) q = q.eq("alias", data.alias);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getTrace = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    const { data: t } = await c.db.from("traces").select("*").eq("id", data.id).maybeSingle();
    if (!t) return null;
    if (!c.perms.includes("view_content")) {
      t.request_preview = t.request_preview ? "[hidden — requires Security/Org Admin role]" : null;
      t.response_preview = t.response_preview ? "[hidden — requires Security/Org Admin role]" : null;
    }
    return t;
  });

/* ---------- finops ---------- */
export const getFinops = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const [{ data: gov }, { data: projects }, { data: traces }, { data: pricing }, { data: keys }] = await Promise.all([
    c.db.from("governance").select("*").order("team"),
    c.db.from("projects").select("id,name,team,business_unit,app_name,budget_usd,spent_usd,environment"),
    c.db.from("traces").select("created_at,team,project_name,alias,key_prefix,input_tokens,output_tokens,cost,usage_estimated").order("created_at", { ascending: false }).limit(1000),
    c.db.from("pricing").select("*").order("provider"),
    c.db.from("gateway_keys").select("name,prefix,last4,environment,status,last_used,spend,tokens"),
  ]);
  return { gov: gov ?? [], projects: projects ?? [], traces: traces ?? [], pricing: pricing ?? [], keys: keys ?? [], canEdit: c.perms.includes("manage_finops") };
});

export const savePricing = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; input_price: number; output_price: number; cached_price: number; effective_from?: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_finops");
    const { data: prev } = await c.db.from("pricing").select("*").eq("id", data.id).single();
    await c.db.from("pricing").update({ effective_to: new Date().toISOString().slice(0, 10) }).eq("id", data.id);
    await c.db.from("pricing").insert({ provider: prev.provider, model: prev.model, input_price: data.input_price, output_price: data.output_price, cached_price: data.cached_price, effective_from: data.effective_from ?? new Date().toISOString().slice(0, 10) });
    await c.db.from("models").update({ input_price: data.input_price, output_price: data.output_price, cached_price: data.cached_price }).eq("provider_model", prev.model);
    await audit(c.db, c.user.name, "Pricing Changed", `pricing:${prev.model}`, `${prev.input_price}/${prev.output_price}`, `${data.input_price}/${data.output_price}`);
    return { ok: true };
  });

/* ---------- alerts & audit ---------- */
export const listAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  const { data } = await c.db.from("alerts").select("*").order("created_at", { ascending: false });
  return data ?? [];
});
export const alertAction = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; action: "acknowledge" | "resolve" | "snooze" | "assign"; assignee?: string }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    if (c.perms.length === 0) throw new Error("Viewers cannot change alerts.");
    const patch: any =
      data.action === "acknowledge" ? { status: "acknowledged" } : data.action === "resolve" ? { status: "resolved" } : data.action === "snooze" ? { status: "snoozed", snoozed_until: new Date(Date.now() + 86400000).toISOString() } : { assignee: data.assignee || c.user.name };
    await c.db.from("alerts").update(patch).eq("id", data.id);
    await audit(c.db, c.user.name, `Alert ${data.action}`, `alert:${data.id.slice(0, 8)}`, null, patch.status ?? patch.assignee);
    return { ok: true };
  });
export const listAudit = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx("view_audit").catch(() => ctx());
  const { data } = await c.db.from("audit_events").select("*").order("created_at", { ascending: false }).limit(400);
  return data ?? [];
});

/* ---------- live demo helpers ---------- */
export const demoFinanceKey = createServerFn({ method: "POST" }).handler(async () => {
  const c = await ctx("approve");
  let { data: p } = await c.db.from("projects").select("*").eq("name", "Finance Copilot (Demo)").maybeSingle();
  if (!p) p = (await c.db.from("projects").insert({ name: "Finance Copilot (Demo)", team: "Finance", business_unit: "Finance", owner_id: c.user.id, owner_name: c.user.name, environment: "Production", use_case: "Variance analysis", data_class: "CONFIDENTIAL", app_name: "Finance Copilot" }).select().single()).data;
  for (const alias of ["qz-fast", "qz-reasoning"]) {
    const { data: e } = await c.db.from("entitlements").select("id").eq("project_id", p.id).eq("alias", alias).eq("status", "active").eq("exception", false);
    if (!e?.length) await c.db.from("entitlements").insert({ project_id: p.id, alias, environment: "Production", max_class: "CONFIDENTIAL", monthly_budget: 2000, logging: "NO CONTENT RETENTION", expires_at: new Date(Date.now() + 60 * 86400000).toISOString() });
  }
  await c.db.from("entitlements").update({ status: "expired" }).eq("project_id", p.id).eq("exception", true);
  await c.db.from("matrix").upsert({ team: "Finance", alias: "qz-reasoning", environment: "Production", state: "ALLOWED" });
  const k = await mintKey("Production");
  await c.db.from("gateway_keys").insert({ name: "finance-copilot-demo", prefix: k.prefix, last4: k.last4, key_hash: k.hash, project_id: p.id, owner_id: c.user.id, owner_name: "svc-finance-copilot", kind: "service", environment: "Production", aliases: ["qz-fast", "qz-reasoning"], scopes: ["responses:write", "chat:write", "models:read"], budget: 2000, rpm: 120, expires_at: new Date(Date.now() + 60 * 86400000).toISOString() });
  return { project_id: p.id, key: k.raw };
});

export const demoTempAccess = createServerFn({ method: "POST" })
  .inputValidator(v<{ project_id: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("approve");
    const { data: r } = await c.db
      .from("access_requests")
      .insert({ project_id: data.project_id, requester_id: c.user.id, requester_name: "svc-finance-copilot", team: "Finance", business_unit: "Finance", kind: "Temporary Entitlement", alias: "qz-reasoning", environment: "Production", data_class: "CONFIDENTIAL", expected_spend: 100, duration_days: 7, justification: "Quarter-close variance analysis", outcome: "ADMIN APPROVAL REQUIRED", status: "pending" })
      .select()
      .single();
    return r;
  });

export const demoAnalyticsBudget = createServerFn({ method: "POST" })
  .inputValidator(v<{ enforcement: string }>())
  .handler(async ({ data }) => {
    const c = await ctx("manage_finops");
    await c.db.from("governance").update({ spent_usd: 10900, enforcement: data.enforcement }).eq("team", "Analytics");
    let { data: p } = await c.db.from("projects").select("*").eq("name", "Customer Insights (Demo)").maybeSingle();
    if (!p) p = (await c.db.from("projects").insert({ name: "Customer Insights (Demo)", team: "Analytics", business_unit: "Analytics", owner_id: c.user.id, owner_name: c.user.name, environment: "Development", use_case: "Segment analysis", data_class: "INTERNAL", app_name: "Customer Insights Assistant" }).select().single()).data;
    for (const alias of ["qz-reasoning", "qz-balanced"]) {
      const { data: e } = await c.db.from("entitlements").select("id").eq("project_id", p.id).eq("alias", alias).eq("status", "active");
      if (!e?.length) await c.db.from("entitlements").insert({ project_id: p.id, alias, environment: "Development", max_class: "INTERNAL", monthly_budget: 3000, logging: "REDACTED CONTENT", expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
    }
    const k = await mintKey("Development");
    await c.db.from("gateway_keys").insert({ name: "customer-insights-demo", prefix: k.prefix, last4: k.last4, key_hash: k.hash, project_id: p.id, owner_id: c.user.id, owner_name: c.user.name, environment: "Development", aliases: ["qz-reasoning", "qz-balanced"], scopes: ["responses:write", "chat:write", "models:read"], budget: 3000, rpm: 120, expires_at: new Date(Date.now() + 90 * 86400000).toISOString() });
    await audit(c.db, c.user.name, "Budget Changed", "governance:Analytics", null, `91% · ${data.enforcement}`);
    return { key: k.raw };
  });

/* ---------- Ask Q-GATE ---------- */
export const askQgate = createServerFn({ method: "POST" })
  .inputValidator(v<{ mode: string; question: string }>())
  .handler(async ({ data }) => {
    const c = await ctx();
    const db = c.db;
    const [{ data: gov }, { data: aliases }, { data: matrix }, { data: traces }, { data: keys }, { data: providers }, { data: models }] = await Promise.all([
      db.from("governance").select("team,budget_usd,spent_usd,enforcement,logging,data_class,aliases"),
      db.from("aliases").select("alias,version,strategy,primary_model,fallback_model,max_class,environments"),
      db.from("matrix").select("*"),
      db.from("traces").select("id,created_at,team,project_name,alias,model,status,error_code,policy_id,latency_ms,cost,fallback").order("created_at", { ascending: false }).limit(120),
      db.from("gateway_keys").select("name,environment,status,last_used,owner_name").eq("status", "active").lt("last_used", new Date(Date.now() - 60 * 86400000).toISOString()).limit(40),
      db.from("providers").select("id,name,status,simulated_outage,external,restricted_ok,region"),
      db.from("models").select("id,provider_id,provider_model,status,max_class,latency_ms"),
    ]);
    const qid = data.question.match(/qgr_[a-f0-9]+/)?.[0];
    const specific = qid ? (await db.from("traces").select("*").eq("id", qid).maybeSingle()).data : null;
    const context = JSON.stringify({ gov, aliases, matrix, recent_traces: traces, unused_60d_active_keys: keys, providers, models, specific_trace: specific }).slice(0, 60000);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI assistant unavailable: server credential missing.");
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["answer", "evidence", "policy", "impact", "recommended_action", "links"],
      properties: {
        answer: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
        policy: { type: "string" },
        impact: { type: "string" },
        recommended_action: { type: "string" },
        links: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "target"], properties: { kind: { type: "string", enum: ["trace", "project", "policy", "routing"] }, target: { type: "string" } } } },
      },
    };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: `You are Ask Q-GATE, the assistant inside the Q-GATE AI enterprise gateway control plane for Nova Enterprise, acting as ${data.mode}. Answer ONLY from the provided JSON configuration and telemetry. Cite concrete values (teams, aliases, request IDs, percentages) as evidence. Spend is ESTIMATED FROM CONFIGURED MODEL PRICING. Never claim guaranteed savings; label optimizations as POTENTIAL OPTIMIZATION. If data is insufficient, say so. For links, use kind trace with a qgr_ id, project with a project name, policy with a policy ID, routing with an alias.`,
        input: `CONTEXT:\n${context}\n\nQUESTION: ${data.question}`,
        text: { format: { type: "json_schema", name: "qgate_answer", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Assistant is rate limited, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Assistant error ${res.status}: ${t.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const j = JSON.parse(line.slice(5));
          if (j.type === "response.output_text.delta") out += j.delta;
        } catch {
          /* ignore */
        }
      }
    }
    try {
      return JSON.parse(out);
    } catch {
      return { answer: out || "No answer produced.", evidence: [], policy: "", impact: "", recommended_action: "", links: [] };
    }
  });

export const setProjectStatus = createServerFn({ method: "POST" })
  .inputValidator(v<{ id: string; status: "active" | "disabled" }>())
  .handler(async ({ data }) => {
    const c = await ctx("approve");
    const { data: p } = await c.db.from("projects").select("name,status").eq("id", data.id).single();
    await c.db.from("projects").update({ status: data.status }).eq("id", data.id);
    await audit(c.db, c.user.name, data.status === "disabled" ? "Project Disabled" : "Project Enabled", `project:${p.name}`, p.status, data.status);
    return { ok: true };
  });
