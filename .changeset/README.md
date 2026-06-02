# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). Each
published package (`use-chrome-ai`, `@use-chrome-ai/react`, `@use-chrome-ai/vue`) is
versioned **independently**.

To record a change for the next release:

```bash
pnpm changeset
```

Pick the affected packages and the bump (patch/minor/major), write a short summary, and
commit the generated markdown file. At release time, `pnpm version-packages` applies the
bumps and `pnpm release` builds and publishes.
