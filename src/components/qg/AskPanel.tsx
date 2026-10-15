/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Radar, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { askQgate } from "@/lib/qgate/api.functions";
import { Badge, errMsg, Select } from "./ui";

const MODES = ["AI Platform Admin", "Security Analyst", "FinOps Analyst", "Developer Support", "Observability Analyst"];
const SUGGESTIONS = [
  "Which team spent the most this week?",
  "Who can use qz-reasoning in production?",
  "Which projects may exceed budget?",
  "Why did qz-code latency increase?",
  "Which keys have been unused for 60 days?",
  "What route does Finance use for Confidential data?",
  "What is impacted if I disable the gemini-3.1-pro-preview model?",
];

export function AskPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const ask = useServerFn(askQgate);
  const nav = useNavigate();
  const [mode, setMode] = useState(MODES[0]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<{ q: string; a?: any; err?: string }[]>([]);

  async function go(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setQ("");
    setHist((h) => [...h, { q: question }]);
    try {
      const a = await ask({ data: { mode, question } });
      setHist((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, a } : x)));
    } catch (e) {
      setHist((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, err: errMsg(e) } : x)));
    }
    setBusy(false);
  }

  const open_ = (l: any) => {
    onOpenChange(false);
    if (l.kind === "trace") nav({ to: "/trace/$id", params: { id: l.target } });
    else if (l.kind === "policy") nav({ to: "/policies" });
    else if (l.kind === "routing") nav({ to: "/routing" });
    else nav({ to: "/developer" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground">
              <Radar className="h-4 w-4" />
            </span>
            Ask Q-GATE
          </SheetTitle>
          <div className="mt-2">
            <Select value={mode} onChange={setMode} options={MODES} />
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!hist.length && (
            <div className="space-y-2">
              <div className="eyebrow">Try asking</div>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => go(s)} className="block w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          )}
          {hist.map((h, i) => (
            <div key={i} className="space-y-3">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{h.q}</div>
              {!h.a && !h.err && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading gateway configuration and telemetry…
                </div>
              )}
              {h.err && <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{h.err}</div>}
              {h.a && (
                <div className="space-y-3 text-sm">
                  <Sec t="Answer">{h.a.answer}</Sec>
                  {!!h.a.evidence?.length && (
                    <Sec t="Evidence">
                      <ul className="list-disc space-y-1 pl-4">
                        {h.a.evidence.map((e: string, j: number) => (
                          <li key={j}>{e}</li>
                        ))}
                      </ul>
                    </Sec>
                  )}
                  {h.a.policy && <Sec t="Policy / Configuration">{h.a.policy}</Sec>}
                  {h.a.impact && <Sec t="Impact">{h.a.impact}</Sec>}
                  {h.a.recommended_action && <Sec t="Recommended Action">{h.a.recommended_action}</Sec>}
                  <div className="flex flex-wrap gap-2">
                    {(h.a.links ?? []).slice(0, 4).map((l: any, j: number) => (
                      <Button key={j} size="sm" variant="outline" onClick={() => open_(l)}>
                        Open {l.kind} · {l.target}
                      </Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); nav({ to: "/routing" }); }}>
                      Test Change
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <form
          className="flex gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about spend, routes, policies, traces…" className="h-10 flex-1 rounded-lg border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          <Button type="submit" disabled={busy} size="icon" className="h-10 w-10">
            {busy ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Sec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <Badge tone="info" className="mb-1.5">
        {t.toUpperCase()}
      </Badge>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
