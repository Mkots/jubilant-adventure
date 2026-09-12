---
name: execute-plan-and-merge
description: "Execute a supplied implementation plan end to end in a GitHub repository: create a dedicated branch, implement and verify the work, push it, open or reuse a pull request, wait for CI, merge into main, synchronize local main, and give a brief report. Use only when the user explicitly requests the full delivery and merge workflow; do not use for planning, review-only work, or changes that must remain unmerged."
---

# Execute Plan and Merge

Treat the supplied plan, whether inline or in a file, as the scope of work. Complete the workflow without handing routine steps back to the user.

## Authorization and safety

- Confirm that the request explicitly authorizes creating and pushing a branch, opening a pull request, and merging it into `main`. Explicit invocation of this skill with a plan counts as authorization.
- Stay within the plan. Ask a concise question only when a missing decision would materially change the result.
- Never discard, overwrite, or silently include pre-existing work. If the worktree is dirty, continue only when the user explicitly identified those changes as part of the plan; otherwise stop and report the blocker.
- Never force-push, use `--admin`, bypass branch protection, weaken CI, approve the agent's own pull request, or merge with failing, cancelled, missing, or still-pending checks.
- Do not expose credentials or commit secrets. Do not make unrelated cleanup changes.

## Preconditions

1. Read the plan completely and inspect repository instructions such as `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` when present.
2. Verify that this is a Git repository with an `origin` remote hosted on GitHub, that `main` exists, and that `git` and `gh` are available.
3. Run `gh auth status` and verify that the authenticated account can push and create or merge pull requests. If authentication or permissions are missing, stop with the exact failing command and a short remedy.
4. Record the starting branch, `git status --short --branch`, and the current `main` SHA. Resolve any unsafe local state before making changes.
5. Start from an up-to-date base:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

Stop if `main` cannot be updated with a fast-forward. Create a unique, readable branch from this updated `main`, using the repository's naming convention when one exists and otherwise `<type>/<short-plan-slug>`.

## Execute the plan

1. Inspect the relevant code before editing and follow established project patterns.
2. Implement every applicable plan item. Keep a small checklist so omissions are visible.
3. Add or update tests in proportion to the behavioral risk. Run the repository's focused checks first, then its standard validation suite.
4. Review the complete diff against `main` for scope, generated artifacts, credentials, debugging code, and accidental files.
5. If the plan is already satisfied and no change is needed, do not manufacture an empty commit or pull request. Verify the behavior and report that result.
6. Stage only intended files, create an informative commit, and push the branch with upstream tracking:

```bash
git push --set-upstream origin HEAD
```

Honor repository hooks. Fix hook failures instead of bypassing them unless the user explicitly authorizes a bypass.

## Pull request and CI

1. Reuse an open pull request for the branch if one exists; otherwise create one targeting `main` with `gh pr create`. Include a concise summary and the local checks run.
2. Capture the pull request number or URL and the pushed head SHA. Before merging, ensure the pull request still points at that SHA.
3. Wait for checks to register. If GitHub initially reports no checks, poll at a modest interval for up to 10 minutes. Once checks exist, wait for all of them with:

```bash
gh pr checks <pr-number-or-url> --watch --fail-fast
```

Do not treat a temporarily pending check as a blocker and do not end the task while CI is still making progress.

4. If CI fails, inspect the failed job and logs, fix only issues within the plan's scope, rerun relevant local checks, commit, push, and wait for CI on the new head SHA. Make at most three CI repair cycles; after that, report the persistent failure instead of looping indefinitely.
5. Before merge, verify that all reported checks for the current head completed successfully and that GitHub reports the pull request as mergeable. Required reviews or unresolved conflicts are blockers; do not bypass them.

## Merge and synchronize

Use the repository's established merge method. If none is documented, use squash merge. Protect against merging a head that changed after CI by supplying the verified SHA:

```bash
gh pr merge <pr-number-or-url> --squash --match-head-commit <verified-head-sha>
```

If the repository uses a merge queue, wait until the pull request state is actually `MERGED`; being queued is not completion. Verify the merged state and record the merge commit and pull request URL.

After the remote merge completes, synchronize the local checkout exactly in this order:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

Confirm that local `main` matches `origin/main` and that the worktree is clean. Do not delete the source branch unless the user or repository policy asks for it.

## Report

Reply in the user's language and keep the report brief. Include:

- whether the plan was completed and merged;
- branch name and pull request link;
- local checks and CI result;
- merge commit and confirmation that local `main` is current.

If blocked, state the exact stage, the concrete reason, what was already completed, and the single next action needed from the user. Never claim completion before the pull request is merged and local `main` is synchronized.
