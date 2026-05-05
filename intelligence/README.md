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
