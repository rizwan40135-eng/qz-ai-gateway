/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext } from "react";

export interface Filters {
  bu: string;
  team: string;
  env: string;
  provider: string;
  alias: string;
  range: string;
  project: string;
}
export const defaultFilters: Filters = { bu: "All", team: "All", env: "All", provider: "All", alias: "All", range: "7d", project: "All" };
export const FiltersContext = createContext<{ f: Filters; set: (p: Partial<Filters>) => void }>({ f: defaultFilters, set: () => {} });
export const useFilters = () => useContext(FiltersContext);

const BU_OF: Record<string, string> = { Engineering: "Technology", Finance: "Finance", Analytics: "Analytics", Commercial: "Commercial", "Supply Chain": "Supply Chain", Research: "Research", HR: "HR" };

export function applyFilters<T extends Record<string, any>>(rows: T[], f: Filters): T[] {
  const now = new Date("2026-10-14T14:00:00Z").getTime();
  const span = f.range === "24h" ? 864e5 : f.range === "7d" ? 7 * 864e5 : 30 * 864e5;
  return rows.filter(
    (r) =>
      (f.team === "All" || r.team === f.team) &&
      (f.bu === "All" || BU_OF[r.team] === f.bu) &&
      (f.env === "All" || r.environment === f.env) &&
      (f.alias === "All" || r.alias === f.alias) &&
      (f.project === "All" || r.project_name === f.project) &&
      (f.provider === "All" || String(r.provider ?? "").startsWith(f.provider)) &&
      (!r.created_at || new Date(r.created_at).getTime() > Math.min(now, Date.now()) - span || new Date(r.created_at).getTime() > now - span),
  );
}
