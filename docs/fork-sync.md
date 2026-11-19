# Syncing your fork with upstream `main`

When `main` in [Mkots/jubilant-adventure](https://github.com/Mkots/jubilant-adventure)
gets updates you need, rebase your work onto the new `main` to pick them up.

## 1. Add the original repository as `upstream` (one time only)

```bash
git remote add upstream https://github.com/Mkots/jubilant-adventure.git
```

Check that you see both `origin` (your fork) and `upstream` (the original):

```bash
git remote -v
```

## 2. Save uncommitted work and make a backup

```bash
git status
```

If you have uncommitted changes, commit them or stash them:

```bash
git stash
```

Create a backup branch so you can always go back:

```bash
git branch backup/before-rebase
```

## 3. Fetch the new `main`

```bash
git fetch upstream
```

## 4. Rebase your branch onto `upstream/main`

Switch to the branch with your changes (use your branch name):

```bash
git switch my-branch
```

```bash
git rebase upstream/main
```

If you committed directly to `main` in your fork, do the same while on `main`.

## 5. Resolve conflicts (if any)

Git stops and lists the conflicting files. For each one:

1. Open the file and fix the sections between `<<<<<<<` and `>>>>>>>`.
2. Mark it as resolved:

   ```bash
   git add path/to/file
   ```

3. Continue the rebase:

   ```bash
   git rebase --continue
   ```

If things go wrong, abort and your branch returns to its original state:

```bash
git rebase --abort
```

### Conflicts in `package-lock.json`

Don't fix it by hand. Take the version from the new `main` and regenerate it.
Note that during a rebase `--ours` means the new `main`, not your code:

```bash
git checkout --ours package-lock.json
```

```bash
npm install
```

```bash
git add package-lock.json && git rebase --continue
```

## 6. Verify everything works

```bash
npm ci
```

```bash
npm test
```

## 7. Push to your fork

The rebase rewrote your history, so a plain `push` will be rejected.
Use a safe force push:

```bash
git push --force-with-lease origin my-branch
```

If you stashed changes earlier, restore them:

```bash
git stash pop
```

Once everything works, delete the backup branch:

```bash
git branch -D backup/before-rebase
```

## TL;DR

```bash
git fetch upstream && git rebase upstream/main && git push --force-with-lease
```

## About the "Sync fork" button on GitHub

It only updates your fork's `main` on GitHub. If your `main` has no commits of
your own, it's enough: click it, then run `git pull` locally. If it does have
your own commits, GitHub will offer to discard them. **Don't** — follow the
rebase steps above instead. The button never updates your feature branches.
