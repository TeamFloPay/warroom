# Campaign Atlas

This atlas is the human-readable view of `repos.yaml`. The YAML manifest is the machine-readable source of truth for repo ownership, local paths, specialist context, and resource allowlists.

War Room owns coordination. Child repositories own code.

## Repo Map

| Repo | Status | Local path | Sergeant | Notes |
| --- | --- | --- | --- | --- |
| `TeamFloPay/sdk` | active | `maps/repos/sdk` | SDK Sergeant | SDK packages published as @flopay/*. |
| `TeamFloPay/backend` | active | `maps/repos/backend` | Backend Sergeant | Central API and server-side application. |
| `TeamFloPay/infra` | active | `maps/repos/infra` | Infra Sergeant | Live infrastructure and operational configuration. |
| `TeamFloPay/demo` | active | `maps/repos/demo` | Demo Sergeant | Standalone SDK demo app after extraction from sdk/apps/demo. |
| `TeamFloPay/docs` | active | `maps/repos/docs` | Docs Sergeant | Standalone SDK documentation site after extraction from sdk/apps/docs. |
| `TeamFloPay/dashboard` | active | `maps/repos/dashboard` | Dashboard Sergeant | Standalone dashboard app after extraction from sdk/apps/dashboard. |
| `TeamFloPay/landing` | active | `maps/repos/landing` | Landing Sergeant | Standalone marketing site after extraction from sdk/apps/landing. |

## Ownership Boundaries

- War Room owns repo maps, local command orchestration, company-level agent guidance, local run artifacts, and workflow helpers.
- Child repositories own product source, product tests, package publishing, deployable infrastructure, and repo-specific documentation.
- Product edits produced during a War Room workflow are committed in the owning child repository, not in War Room.

## Territory Snapshot

- Known territory is tracked in `maps/issue-territory.md` and the Campaign Map project.
- Blurry territory starts in `needs-triage` and moves to `ready-to-engage` after a scoped battle plan exists.
- Unmapped territory should become a GitHub issue before implementation unless it is a tiny local War Room maintenance task.

## Specialist Context

### SDK Sergeant

- Repo: `TeamFloPay/sdk`
- Owner: `sdk`
- Focus: SDK packages, package publishing, demo compatibility
- Frameworks: TypeScript, pnpm, Turborepo, tsup
- Resources: GitHub CLI, npm Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=sdk -->
<!-- Add hand-written SDK notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=sdk -->

### Backend Sergeant

- Repo: `TeamFloPay/backend`
- Owner: `backend`
- Focus: billing API, checkout orchestration, payment provider integrations
- Frameworks: NestJS, TypeScript, PostgreSQL
- Resources: GitHub CLI, NestJS Documentation, Stripe API, Stripe Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=backend -->
<!-- Add hand-written backend notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=backend -->

### Infra Sergeant

- Repo: `TeamFloPay/infra`
- Owner: `infra`
- Focus: infrastructure safety, deployment wiring, DNS
- Frameworks: Terraform, Railway, Cloudflare
- Resources: GitHub CLI, Railway Documentation, Cloudflare Documentation

<!-- warroom:notes:start repo=infra -->
<!-- Add hand-written infra notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=infra -->

### Demo Sergeant

- Repo: `TeamFloPay/demo`
- Owner: `app-demo`
- Focus: SDK verification, checkout demos, local SDK linking
- Frameworks: Next.js, Playwright, React
- Resources: CodeRabbit, GitHub CLI, Next.js Documentation, Playwright Documentation, Stripe API, Stripe Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=demo -->
<!-- Add hand-written demo notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=demo -->

### Docs Sergeant

- Repo: `TeamFloPay/docs`
- Owner: `app-docs`
- Focus: SDK documentation, examples, API reference
- Frameworks: Next.js, Fumadocs, MDX
- Resources: GitHub CLI, Next.js Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=docs -->
<!-- Add hand-written docs notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=docs -->

### Dashboard Sergeant

- Repo: `TeamFloPay/dashboard`
- Owner: `app-dashboard`
- Focus: billing dashboard, admin workflows
- Frameworks: Next.js, React
- Resources: GitHub CLI, Next.js Documentation, Stripe API, Stripe Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=dashboard -->
<!-- Add hand-written dashboard notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=dashboard -->

### Landing Sergeant

- Repo: `TeamFloPay/landing`
- Owner: `app-landing`
- Focus: marketing site, public product pages
- Frameworks: Next.js, React
- Resources: GitHub CLI, Next.js Documentation, TypeScript Documentation

<!-- warroom:notes:start repo=landing -->
<!-- Add hand-written landing notes here. This block should be preserved by future atlas generation. -->
<!-- warroom:notes:end repo=landing -->
