# Intelligence

This directory defines the first reporting boundary for Brigadier Kirkpatrick, the War Room intelligence/reporting layer.

## Boundary

- Reports summarize operational facts for the General; they do not mutate product systems.
- Live Sentry, Metabase, Stripe, and scheduled report integrations are deferred until stable report contracts exist.
- Manual exports, screenshots, copied summaries, or fixture JSON can be stored locally while developing a report shape, but secrets and private connection details are not committed.
- GitHub issue/PR comments should receive useful summaries, not local artifact paths.

## Report Contract

Each report should include:

- `title`
- `generated_at`
- `source`
- `summary`
- `signals`
- `risks`
- `recommended_actions`
- `follow_up_issues`

Store generated local reports under ignored `.warroom/runs/*` unless the report is a safe fixture or documentation example.

## Manual Inputs

The first version accepts fixture/manual inputs only. Use `intelligence/reports/manual-input.fixture.json` as the contract example for copied operational observations, Sentry issue summaries, Metabase KPI snapshots, Stripe notes, or scheduled-report prototypes.

Rules for committed fixtures:

- Use representative but fake values.
- Do not include customer data, secrets, private endpoints, access tokens, or live connection details.
- Link follow-up work through GitHub issue URLs or issue references, not local-only notes.

Deferred live integrations remain tracked outside this MVP: scheduled/recurring intelligence workflows in TeamFloPay/infra#6, and post-victory metrics in TeamFloPay/infra#9.
