<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All DB tables have RLS on with no client policies; every read/write goes through server functions in `src/lib/qgate/api.functions.ts` that verify the Lovable identity and role server-side — browser never touches tables directly.
- The public AI gateway lives at `src/routes/api/public/v1/$.ts` and authenticates only by Q-GATE key hash; all governance checks run in `src/lib/qgate/gateway.server.ts` on every request — never cache authorization decisions.
- Provider credentials stay server-side (env or `provider_secrets` table) and are never returned to clients — only last-4 hints.
- Pure policy logic (preflight, DLP, RBAC) lives in browser-safe modules under `src/lib/qgate/` with tests in `src/test/qgate-rules.test.ts` — keep rules testable without the DB.
- Shared UI primitives for the console live in `src/components/qg/`; console pages sit under the `_console` layout.
