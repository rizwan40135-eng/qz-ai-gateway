import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Q-GATE AI — The Enterprise AI Gateway & Control Plane" },
      { name: "description", content: "One enterprise endpoint, one governance layer, every approved AI provider. Connect. Govern. Route. Observe. Optimize." },
      { property: "og:title", content: "Q-GATE AI — The Enterprise AI Gateway & Control Plane" },
      { property: "og:description", content: "From fragmented AI access to governed enterprise AI infrastructure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PIPE = ["Q-GATE Key", "Identity", "Project", "Entitlement", "Environment", "Data Class", "DLP", "Budget", "Rate Limit", "Alias", "Routing", "Provider", "Tokens · Cost · Trace · Audit"];
const WITHOUT = ["Developer receives a provider account", "Raw provider key handed out", "Provider model hard-coded", "Governance, spend and logs fragmented", "Model migration requires code change"];
const WITH = ["User requests a capability", "Admin / policy approves", "Entitlement created", "User creates a Q-GATE virtual key", "Calls one endpoint with an enterprise alias", "Every request governed, routed and traced", "Admin changes provider — code unchanged"];

function Landing() {
  return (
    <div className="hero-surface min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-primary font-display font-bold text-primary-foreground">
            Q<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-ember" />
          </span>
          <div className="leading-tight">
            <div className="font-display font-semibold">Q-GATE AI</div>
            <div className="text-[10px] text-muted-foreground">Powered by Quantzig</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/docs">Documentation</Link></Button>
          <Button asChild><Link to="/command">Open console</Link></Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-12 md:pt-20">
        <div className="eyebrow text-ember">Connect · Govern · Route · Observe · Optimize</div>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.05] md:text-6xl">
          The enterprise AI gateway <span className="text-primary">&amp; control plane.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          One enterprise endpoint. One governance layer. Every approved AI provider. Users request access, admins control approval, and provider credentials never leave Q-GATE.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/developer">Build with approved AI <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="ember"><Link to="/demo">Run live demo</Link></Button>
        </div>

        <div className="panel mt-14 overflow-x-auto p-5">
          <div className="eyebrow mb-4">Every request · every time</div>
          <div className="flex min-w-max items-center gap-1.5">
            <span className="rounded-lg bg-navy px-3 py-2 font-mono text-xs text-navy-foreground">model="qz-code"</span>
            {PIPE.map((p, i) => (
              <motion.span key={p} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">→</span>
                <span className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${i === PIPE.length - 1 ? "border-ember bg-peach text-ember" : "bg-card"}`}>{p}</span>
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-20 md:grid-cols-2">
        <div className="panel p-7">
          <div className="eyebrow">Without Q-GATE</div>
          <ul className="mt-4 space-y-3">
            {WITHOUT.map((w) => (
              <li key={w} className="flex gap-3 text-sm"><X className="h-4 w-4 shrink-0 text-danger" />{w}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-navy p-7 text-navy-foreground">
          <div className="eyebrow text-ember">With Q-GATE</div>
          <ul className="mt-4 space-y-3">
            {WITH.map((w) => (
              <li key={w} className="flex gap-3 text-sm"><Check className="h-4 w-4 shrink-0 text-ember" />{w}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-4">
          {["Every request is governed.", "Every token is visible.", "Every cost is attributable.", "Models change without application changes."].map((t) => (
            <div key={t} className="panel p-5 font-display text-lg font-semibold">{t}</div>
          ))}
        </div>
        <p className="mt-12 text-center font-display text-2xl font-semibold md:text-3xl">
          From fragmented AI access <span className="text-ember">to governed enterprise AI infrastructure.</span>
        </p>
      </section>
    </div>
  );
}
