# Visual regression tests

The visual suite uses Playwright `toHaveScreenshot` against deterministic
Storybook stories. It covers the catalog at desktop and narrow widths, checkout
validation focus, a filled narrow cart, and the admin order state.

## Commands

```bash
npm run test:visual
npm run test:visual:update
npm run test:visual:update -- --help
```

Baseline updates are deliberate source changes. Generate them in the same
Linux Playwright image as CI, review the generated PNG diff in git, and include
the approved baseline in the same pull request as the UI change:

```bash
docker run --platform linux/amd64 --rm --ipc=host \
  -v "$PWD":/work -v b09_node_modules:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble npm ci
docker run --platform linux/amd64 --rm --ipc=host \
  -v "$PWD":/work -v b09_node_modules:/work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.63.0-noble npm run test:visual:update
```

The shorter update command remains useful when intentionally refreshing local
experiments. CI never passes `--update-snapshots`.

Rendering inputs are pinned to Chromium, a light color scheme, `en-US`, UTC,
reduced motion, and fixed viewport sizes. Playwright disables animations and
transitions while capturing. No screenshot uses a mask: all displayed values
come from fixed Storybook fixtures. If a future story needs a mask, document the
masked locator and why its value cannot be made deterministic beside that test.

The narrow long-content catalog is also the teaching defect for the later
defect catalog: in a disposable worktree, changing `.product-card { min-width:
0; }` to `min-width: 40rem` causes `catalog-long-content-narrow` to fail with a
layout-only screenshot diff while its role and text assertions still pass.

On failure, CI uploads Playwright's actual, expected, and diff images together
with the HTML report for 14 days.
