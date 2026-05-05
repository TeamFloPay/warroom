# Release Process

War Room does not release product code. Product releases remain owned by the child repository that builds, tests, deploys, or publishes the artifact.

## War Room Changes

```sh
npm run build
npm run typecheck
npm test
git status --short
git commit -m "feat: describe war room change"
git push
```

## SDK Package Changes

Use the SDK repo's release and publishing workflow. War Room can help validate unreleased SDK changes in the standalone demo with:

```sh
npm run warroom -- dev link
cd ../demo
corepack pnpm build
corepack pnpm typecheck
```

Restore normal published-package behavior afterward:

```sh
cd ../warroom
npm run warroom -- dev unlink
```
