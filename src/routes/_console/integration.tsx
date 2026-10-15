/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge, Code, gatewayBase, inputCls, PageHeader, Panel, Select, useSessionKey } from "@/components/qg/ui";
import { callGateway } from "@/components/qg/gatewayClient";
import { ALIASES } from "@/lib/qgate/constants";
import { snippets } from "@/components/qg/snippets";

export const Route = createFileRoute("/_console/integration")({
  validateSearch: (s: Record<string, unknown>): { alias?: string } => ({ alias: typeof s.alias === "string" ? s.alias : undefined }),
  head: () => ({
    meta: [
      { title: "Integration & Coding Tools — Q-GATE AI" },
      { name: "description", content: "OpenAI- and Anthropic-compatible integration snippets and coding tool profiles for the Q-GATE endpoint." },
      { property: "og:title", content: "Integration & Coding Tools — Q-GATE AI" },
      { property: "og:description", content: "Connect any OpenAI- or Anthropic-compatible client to Q-GATE." },
    ],
  }),
  component: Integration,
});

type T = { n: string; s: "idle" | "run" | "ok" | "fail"; d?: string; id?: string | null };

function Profile({ kind, alias, keyVal }: { kind: "openai" | "anthropic"; alias: string; keyVal: string }) {
  const tests = kind === "openai" ? ["GET /v1/models", "POST /v1/responses", "Streaming", "Tool Calling"] : ["Messages", "Streaming", "System Prompt", "Tool Definitions"];
  const [res, setRes] = useState<T[]>(tests.map((n) => ({ n, s: "idle" })));
  const ready = res.every((r) => r.s === "ok");
  async function run() {
    const out: T[] = tests.map((n) => ({ n, s: "run" }));
    setRes([...out]);
    const done = (i: number, ok: boolean, d: string, id?: string | null) => {
      out[i] = { n: tests[i], s: ok ? "ok" : "fail", d, id };
      setRes([...out]);
    };
    try {
      if (kind === "openai") {
        const m = await callGateway({ key: keyVal, method: "GET", path: "/models" });
        done(0, m.status === 200 && m.json.data.some((x: any) => x.id === alias), `${m.status} · ${m.json?.data?.map((x: any) => x.id).join(", ") ?? m.json?.error?.message}`);
        const r = await callGateway({ key: keyVal, path: "/responses", body: { model: alias, input: "Say OK." } });
        done(1, r.status === 200, `${r.status} · ${r.text.slice(0, 80) || r.json?.error?.message}`, r.requestId);
        const s = await callGateway({ key: keyVal, path: "/responses", body: { model: alias, input: "Count to five.", stream: true } });
        done(2, s.status === 200 && s.events.length > 2, `${s.events.length} SSE events`, s.requestId);
        const t = await callGateway({ key: keyVal, path: "/chat/completions", body: { model: alias, messages: [{ role: "user", content: "hi" }], tools: [{ type: "function", function: { name: "get_weather", parameters: { type: "object", properties: {} } } }] } });
        done(3, t.status === 200, t.status === 200 ? "Tool definitions accepted & governed by tool policy" : t.json?.error?.message, t.requestId);
      } else {
        const m = await callGateway({ key: keyVal, path: "/messages", body: { model: alias, max_tokens: 64, messages: [{ role: "user", content: "Say OK." }] } });
        done(0, m.status === 200 && m.json?.type === "message", `${m.status} · ${m.text.slice(0, 80) || m.json?.error?.message}`, m.requestId);
        const s = await callGateway({ key: keyVal, path: "/messages", body: { model: alias, max_tokens: 64, stream: true, messages: [{ role: "user", content: "Count to three." }] } });
        done(1, s.status === 200 && s.events.some((e) => e.includes("message_stop")), `${s.events.length} events incl. message_stop`, s.requestId);
        const sp = await callGateway({ key: keyVal, path: "/messages", body: { model: alias, max_tokens: 64, system: "Answer only with the word GATE.", messages: [{ role: "user", content: "What is the word?" }] } });
        done(2, sp.status === 200, `${sp.status} · ${sp.text.slice(0, 60)}`, sp.requestId);
        const td = await callGateway({ key: keyVal, path: "/messages", body: { model: alias, max_tokens: 64, tools: [{ name: "lookup_ticket", input_schema: { type: "object", properties: {} } }], messages: [{ role: "user", content: "hi" }] } });
        done(3, td.status === 200, td.status === 200 ? "Tool definitions accepted & governed" : td.json?.error?.message, td.requestId);
      }
    } catch (e: any) {
      out.forEach((o, i) => o.s === "run" && done(i, false, e.message));
    }
  }
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">{kind === "openai" ? "OpenAI-compatible client" : "Anthropic-compatible client"}</div>
          <div className="mt-1 font-display text-lg font-semibold">Coding tool profile</div>
        </div>
        <Badge tone={ready ? "success" : "muted"}>{ready ? "READY" : "NOT VERIFIED"}</Badge>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">API Key</dt><dd className="font-mono text-xs">{keyVal ? keyVal.slice(0, 13) + "…" + keyVal.slice(-4) : "Q-GATE key"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{kind === "openai" ? "Base URL" : "Messages Endpoint"}</dt><dd className="break-all font-mono text-xs">{gatewayBase()}{kind === "anthropic" ? "/messages" : ""}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Model</dt><dd className="font-mono text-xs">{alias}</dd></div>
      </dl>
      <div className="mt-4 divide-y rounded-xl border">
        {res.map((r) => (
          <div key={r.n} className="flex items-center gap-3 px-3 py-2 text-xs">
            {r.s === "ok" ? <CheckCircle2 className="h-4 w-4 text-success" /> : r.s === "fail" ? <XCircle className="h-4 w-4 text-danger" /> : r.s === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
            <span className="w-32 font-semibold">{r.n}</span>
            <span className="flex-1 truncate text-muted-foreground">{r.d}</span>
            {r.id && <Link to="/trace/$id" params={{ id: r.id }} className="font-mono text-primary">trace</Link>}
          </div>
        ))}
      </div>
      <Button className="mt-4 w-full" onClick={run} disabled={!keyVal}>Run compatibility test</Button>
    </Panel>
  );
}

function Integration() {
  const search = Route.useSearch();
  const sk = useSessionKey();
  const [alias, setAlias] = useState(search.alias ?? sk?.alias ?? "qz-code");
  const [key, setKey] = useState(sk?.key ?? "");
  const base = gatewayBase();
  const sn = snippets(base, key || "<Q-GATE KEY>", alias);
  return (
    <div className="space-y-6">
      <PageHeader index="Integration" title="View integration & connect coding tools" subtitle="Snippets are generated from the live gateway configuration and your enterprise alias. The underlying provider model is never exposed." />
      <Panel className="grid gap-3 p-4 md:grid-cols-[200px_1fr]">
        <Select value={alias} onChange={setAlias} options={ALIASES} />
        <input className={inputCls + " font-mono"} placeholder="Paste your Q-GATE key (qzg_live_…) — kept in this tab only" value={key} onChange={(e) => setKey(e.target.value.trim())} />
      </Panel>
      <Tabs defaultValue="openai">
        <TabsList className="flex-wrap">
          <TabsTrigger value="openai">OpenAI-Compatible</TabsTrigger>
          <TabsTrigger value="anthropic">Anthropic-Compatible</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="node">Node.js</TabsTrigger>
          <TabsTrigger value="curl">cURL</TabsTrigger>
          <TabsTrigger value="rest">REST</TabsTrigger>
        </TabsList>
        <TabsContent value="openai" className="space-y-3">
          <Code title=".env" code={sn.env} />
          <Code title="python · openai sdk" code={sn.openai} />
        </TabsContent>
        <TabsContent value="anthropic"><Code title="python · anthropic sdk" code={sn.anthropic} /></TabsContent>
        <TabsContent value="python"><Code title="python · requests" code={sn.python} /></TabsContent>
        <TabsContent value="node"><Code title="node.js" code={sn.node} /></TabsContent>
        <TabsContent value="curl"><Code title="bash" code={sn.curl} /></TabsContent>
        <TabsContent value="rest"><Code title="http" code={sn.rest} /></TabsContent>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-2">
        <Profile kind="openai" alias={alias} keyVal={key} />
        <Profile kind="anthropic" alias={alias} keyVal={key} />
      </div>
    </div>
  );
}
