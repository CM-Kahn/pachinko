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

## Tuning

- The board layout is data: `src/board/classic.json` (format described in `src/board/types.ts`).
- The feel of the physics (gravity, bounce, launch variation) is the `TUNING` block in
  `src/physics/sim.ts`; the firing rhythm is at the top of `src/launcher.ts`.
- Add `?stress=60` to the address to keep 60 balls on the board for performance checks.

## Deploy

Every push runs the checks in GitHub Actions. Pushes to `main` also publish `dist/` to
GitHub Pages (repo Settings → Pages → Source must be set to **GitHub Actions**).
