/* eslint-disable @typescript-eslint/no-explicit-any */
// Browser-side client for the public Q-GATE endpoint. Uses ONLY the user's own Q-GATE key.
import { gatewayBase } from "./ui";

export interface CallResult {
  status: number;
  requestId: string | null;
  headers: Record<string, string>;
  json?: any;
  text: string;
  events: string[];
  ms: number;
}

export async function callGateway(opts: {
  key: string;
  method?: "GET" | "POST";
  path: string;
  body?: any;
  headers?: Record<string, string>;
  onDelta?: (t: string) => void;
}): Promise<CallResult> {
  const t0 = performance.now();
  const res = await fetch(gatewayBase() + opts.path, {
    method: opts.method ?? "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: opts.method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
  });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  const requestId = res.headers.get("x-qgate-request-id");
  const events: string[] = [];
  let text = "";
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream") && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        events.push(block);
        const data = block.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const d = j.delta?.text ?? (typeof j.delta === "string" ? j.delta : undefined) ?? j.choices?.[0]?.delta?.content;
          if (d) {
            text += d;
            opts.onDelta?.(text);
          }
        } catch {
          /* ignore */
        }
      }
    }
    return { status: res.status, requestId, headers, text, events, ms: Math.round(performance.now() - t0) };
  }
  const json = await res.json().catch(() => null);
  text = json?.output_text ?? json?.choices?.[0]?.message?.content ?? json?.content?.[0]?.text ?? "";
  return { status: res.status, requestId, headers, json, text, events, ms: Math.round(performance.now() - t0) };
}
