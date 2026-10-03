# Agent guide — leverage-frontend-neo

## Scope and source of truth

This repository is the browser UI for Leverage OJ. Its API lives in
`ThinkSpiritLab/leverage-backend-neo`, normally cloned beside this repository.

Read this guide before changing code. Verify contracts against backend controllers
and DTOs, not only existing UI mocks or documentation. This file is intentionally
named `agent.md`; tools that only auto-discover `AGENTS.md` need to be pointed to
this file explicitly.

## Architecture map

- `nuxt.config.ts`: SPA (`ssr: false`), compatibility-version-4 conventions,
  module registration, `/api` proxy and public API base configuration. The package
  manifest declares Nuxt **3.x** with v4 compatibility conventions.
- `app/app.vue`, `app/layouts/`: application shell and public/auth/admin layouts.
- `app/pages/`: file-based routes, including problems, courses, contests,
  submissions, messaging, admin and compete/playground views.
- `app/composables/useApi.ts`: shared Axios instance, bearer injection and refresh
  interception. `app/composables/api/`: domain-specific HTTP wrappers.
- `app/stores/auth.ts`: Pinia session state; refresh token persisted in localStorage.
  `app/plugins/auth-init.ts` restores the session before application use.
- `app/middleware/`: UI navigation guards. These are not a security boundary.
- `app/types/`: handwritten API and botzone types; backend changes require checking
  these and all callers together.
- `app/components/`: shared UI; CodeMirror editor and Markdown/KaTeX presentation.
  `components/botzone/` and `components/compete/` contain playback and match UI.
- `e2e/`: Playwright Chromium tests, including mocked API responses.
- `Dockerfile`: builds Nuxt and serves `.output/server` (Nitro) on port 3000;
  `ssr: false` does not make `.output/public` a complete static site.
  Backend's `deploy/nginx.conf` owns the production `/api` reverse proxy.

## Development and checks

Use pnpm, preserve `pnpm-lock.yaml`, and install explicitly with
`pnpm install --frozen-lockfile`. `postinstall` runs `nuxt prepare`.

- `pnpm dev --port 3001`: explicit frontend port, avoiding backend port 3000.
  Do not assume bare `pnpm dev` is configured to use 3001.
- `pnpm build`: current production build command, also used by Dockerfile.
- `pnpm generate`: static generation command, available separately.
- `pnpm lint`: ESLint check.
- `pnpm typecheck`: regenerate Nuxt types and run the precisely locked `vue-tsc`.
- `pnpm test:regression`: executable refresh/polling regressions and SSE/iframe
  source contracts; does not start a browser or the backend.
- `pnpm test:botzone`: fresh production build, trusted Python example checks and
  a real Chrome iframe-message probe with mock API/SSE; not real judge acceptance.
- `pnpm test:e2e:fe`: Playwright tests; configuration starts/reuses a server at
  `http://localhost:3001` by default. `PLAYWRIGHT_PORT` selects an isolated port;
  set `CI=1` and pass Playwright `--retries=0` when verifying that the snapshot server is
  started rather than reusing an unrelated listener. Requires Chromium, or set
  `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome.
- `pnpm test:e2e:fe -- <spec>`: narrow browser checks to the changed feature.

`NUXT_PUBLIC_API_BASE` defaults to `/api`. Development proxies `/api/*` to
`http://localhost:3000` with the prefix removed. The backend development command
is `pnpm start:dev`, not `pnpm dev`. Check Nginx behavior as well when changing
paths, uploads, SSE or deployment configuration.

Do not claim a mocked Playwright test verifies the live backend contract. Source
probes cover selected logic and are not broad component-unit coverage.
TypeScript checking is available through `pnpm typecheck`; state exactly which
checks were run and which API contracts were exercised.

Mock API routes by URL pathname prefix, not `**/api/**`: Vite also serves
`/_nuxt/composables/api/*.ts`. Seed synthetic auth only in the top-level frame;
sandboxed renderers must not gain storage or same-origin access for a test.

## Change boundaries

1. Keep file-based routing, Pinia and the existing component system unless a
   concrete requirement justifies replacement. Extract repeated behavior or
   independently testable responsibilities rather than creating generic layers.
2. Put domain HTTP calls in `composables/api/` and keep session refresh handling
   centralized. Check refresh failure, concurrent 401s, logout and startup restore;
   a refresh request must not recursively refresh itself.
3. Check ordinary JWT and contest-specific token behavior separately. Never let a
   generic request interceptor silently overwrite an explicit scoped credential.
4. Backend authorization remains mandatory. Hiding a button or blocking a route
   is not sufficient protection for admin actions, private code or match input.
5. Preserve isolation of custom HTML renderers. Do not add `allow-same-origin` to
   an untrusted script-enabled iframe. Authenticate inbound `postMessage` by its
   window/source and validate the message shape before triggering application actions.
6. Clean up timers, polling, EventSource instances and listeners on unmount and
   route changes. Keep human input, pending turns and replay state scoped to the
   current match and player.
7. Treat Markdown, renderer HTML, external URLs and logs as untrusted inputs.
   Keep tokens out of rendered content, logs and committed screenshots.
8. Cover changed behavior with a focused browser check and, for contract changes,
   a real or explicitly validated backend response. Verify loading, empty, failure
   and permission states as well as the happy path.
9. Do not commit `.env`, `.nuxt`, `.output`, `node_modules`, browser artifacts or
   new generated test reports. Existing tracked reports/backups are not templates
   for adding more generated output. Do not enable disabled CI/deploy workflows
   during ordinary local work.

## Documentation

Read `README.md` and `docs/ARCHITECTURE.md` for orientation, but use live source
for versions, commands and API contracts. Keep dated review findings and task
progress separate from this procedural guide.
