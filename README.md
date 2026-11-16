# Pachinko

A free, just-for-fun, retro-style pachinko machine for the browser. Play money only.
See [PLAN.md](PLAN.md) for the full plan and build phases.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run check    # lint, typecheck, unit tests, build, browser smoke tests
```

Browser smoke tests save a screenshot per screen size under `test-results/`.

## Deploy

Every push runs the checks in GitHub Actions. Pushes to `main` also publish `dist/` to
GitHub Pages (repo Settings → Pages → Source must be set to **GitHub Actions**).
