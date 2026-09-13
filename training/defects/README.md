# Intentional defects

This catalog contains reviewed patches, never active broken production code.
Each directory has a machine-readable `defect.json`, a reversible patch, and a
brief. The `apply` command is descriptive metadata; the repository validator
uses a disposable Git worktree so a failed lesson cannot dirty the learner's
checkout.

Authoring rules:

1. Keep one deterministic behavior change per patch.
2. Declare one first detecting layer and the exact command that should fail.
3. Keep credentials and real secrets out of examples.
4. Explain the first useful diagnostic artifact without publishing the fix.
5. Add controlled timing/shared-state examples to `lab/`; never add random or
   order-dependent tests to the default suite.

Use `npm run defects:list` to inspect the catalog and `npm run defects:verify`
to apply every patch, check its expected failure, and remove its disposable
worktree.
