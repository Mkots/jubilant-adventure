# Mutation baseline

Measured on the C-quality branch with the curated Stryker scope:

- 4 source files and 263 mutants
- 181 killed, 49 survived, 5 timed out, 28 no-coverage
- mutation score: `70.72%`
- checked-in break threshold: `70%`

The first run before the representative assertion improvements scored
`57.41%`. The exact-stock and pagination/filter assertions killed meaningful
service mutants, while the triangle boundary assertion added a second explicit
row-shape check. This is an honest baseline: no source files are excluded to
make the score pass, and the normal `npm run ci` does not run Stryker.

Run `npm run test:mutation` twice against unchanged sources and compare the
total (`263`) and score (`70.72%`) in `artifacts/mutation/mutation.json`.
Surviving mutants are retained in the HTML report as teaching material; future
threshold increases should follow stronger assertions.
