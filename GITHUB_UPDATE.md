# Upload or Update This Project on GitHub

This archive is arranged with the repository files at its top level. Extract it before uploading; GitHub does not unpack a ZIP into your repository for you.

## Update an existing repository with Git

1. Clone or open your existing repository locally.
2. Copy all extracted files from this package into the repository root, allowing matching files to be replaced.
3. From the repository root, run:

```bash
git status
git add -A
git commit -m "Add property deal dashboard and validation updates"
git push origin HEAD
```

Using `git push origin HEAD` updates the remote branch that matches your current checked-out branch without assuming it is named `main`.

## Update through the GitHub website

1. Extract this ZIP on your computer.
2. Open the target repository on GitHub.
3. Choose **Add file → Upload files**.
4. Drag the extracted files and folders—not the ZIP itself and not an extra outer folder—into the upload area.
5. Commit directly or create a branch and pull request.

For a large update, Git or GitHub Desktop is usually more reliable because it preserves the full directory structure and makes changed/deleted files easier to review.

## Publish as a new repository

From the extracted project root:

```bash
git init -b main
git add -A
git commit -m "Initial validated release"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Alternatively, with GitHub CLI after signing in:

```bash
gh repo create --source=. --private --remote=origin --push
```

Change `--private` to `--public` only when you are ready to publish the source and bundled data publicly.

## Verify before pushing

```bash
python3 -m unittest discover -s tests -v
python3 app/server.py
```

Then open `http://localhost:8000` and confirm that both **County Research** and **Deal Dashboard** load.

## Files added for repository maintenance

- `.github/workflows/validate.yml` — runs validation on pushes and pull requests.
- `.gitattributes` — normalizes text line endings and marks images as binary.
- `.gitignore` — excludes local caches, virtual environments, secrets, logs, editor files, and generated archives.
- `CHANGELOG.md` — summarizes this update.

Do not commit passwords, API keys, tokens, private property records, or exported CSV files containing information you do not intend to publish.
