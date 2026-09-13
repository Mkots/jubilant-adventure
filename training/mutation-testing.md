# Mutation testing exercise

Line coverage answers: "did execution reach this line?" Mutation testing asks
a stronger question: "would an assertion fail if this behavior changed?"

Run `npm run test:coverage` and compare its line/branch totals with
`npm run test:mutation`. Read `artifacts/mutation/mutation.html` and choose one
surviving mutant in a pure function. Add the smallest assertion that describes
the behavior, run the mutation command again, and record the mutant's new
status in your notes.

The checked-in mutation scope is deliberately small: three exercise utilities
and the shop service rules. It excludes adapters, generated clients, fixtures,
tests, and React rendering. The baseline threshold is 70%; raising it requires
stronger assertions, not merely removing files from the scope.
