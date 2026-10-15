/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/qgate/constants";

export interface Me {
  user: { id: string; name: string; email: string | null; team: string; bu: string } | null;
  roles: string[];
  perms: Permission[];
  error?: string;
}
export const MeContext = createContext<Me>({ user: null, roles: [], perms: [] });
export const useMe = () => useContext(MeContext);
export const useCan = (p: Permission) => useMe().perms.includes(p);

/* In-memory only (never persisted): the last plaintext key the user just created, so
   Test Connection works in this session. Q-GATE stores only the hash server-side. */
let sessionKey: { key: string; alias: string; env: string } | null = null;
const subs = new Set<() => void>();
export const keyStore = {
  set(v: typeof sessionKey) {
    sessionKey = v;
    subs.forEach((s) => s());
  },
};
export function useSessionKey() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => sessionKey,
    () => null,
  );
}

export function gatewayBase() {
  if (typeof window === "undefined") return "https://<your-q-gate-host>/api/public/v1";
  return `${window.location.origin}/api/public/v1`;
}

export function Panel({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel", className)} {...p}>
      {children}
    </div>
  );
}

export function PageHeader({ index, title, subtitle, actions }: { index?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {index && <div className="eyebrow mb-1.5">{index}</div>}
        <h1 className="text-2xl font-semibold md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-primary",
  ember: "bg-peach text-ember",
  muted: "bg-muted text-muted-foreground",
};
export function toneFor(s: string): keyof typeof TONES {
  const v = String(s ?? "").toUpperCase();
  if (/^(PASS|ACTIVE|ALLOWED|APPROVED|READY|AUTO|ENABLED|HEALTHY|OK|200|RESOLVED|COMPLETED)/.test(v)) return "success";
  if (/(WARN|REVIEW|APPROVAL|PENDING|ACKNOWLEDGED|REDACT|UNDER REVIEW|RESTRICTED|SNOOZED|INFO_REQUESTED|MEDIUM|THROTTLE)/.test(v)) return "warning";
  if (/(FAIL|DENIED|BLOCK|REVOKED|REJECTED|DISABLED|DEPRECATED|CRITICAL|HIGH|EXPIRED|ERROR|OUTAGE|4\d\d|5\d\d)/.test(v)) return "danger";
  if (/(SIMULATED|DEMO)/.test(v)) return "ember";
  return "info";
}
export function Badge({ children, tone, className }: { children: ReactNode; tone?: keyof typeof TONES; className?: string }) {
  const t = tone ?? toneFor(String(children));
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide", TONES[t], className)}>{children}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ember" | "brand" }) {
  return (
    <Panel className="p-4">
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-2 text-[26px] font-semibold leading-none", tone === "ember" && "text-ember", tone === "brand" && "text-primary")}>{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </Panel>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[11px] font-semibold opacity-90 transition hover:opacity-100"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Code({ code, title, className }: { code: string; title?: string; className?: string }) {
  return (
    <div className={cn("code-panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2 text-[11px] uppercase tracking-wider opacity-70">
        <span>{title ?? "code"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/40";
export function Select({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: readonly (string | { v: string; l: string })[]; className?: string }) {
  return (
    <select className={cn(inputCls, className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>))}
    </select>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Table({ head, rows, className }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b">
            {head.map((h, i) => (
              <th key={i} className="eyebrow whitespace-nowrap px-3 py-2.5 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 transition hover:bg-muted/50">
              {r.map((c, j) => (
                <td key={j} className="whitespace-nowrap px-3 py-2.5 align-middle">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function errMsg(e: any) {
  return String(e?.message ?? e).replace(/^Error:\s*/, "");
}
