#!/usr/bin/env bash
# Bidirectional synchronization: fetch, pull --rebase, and push the current
# branch when needed. This implements the cross-machine preview loop described
# in docs/architecture/dev-workflow.md and runs on Linux or Windows Git Bash.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

branch="$(git symbolic-ref --quiet --short HEAD)" || {
  echo "Error: sync.sh requires a named branch; HEAD is currently detached." >&2
  exit 1
}

echo "== [sync] branch ${branch}: git fetch =="
git fetch origin

if git show-ref --quiet "refs/remotes/origin/${branch}"; then
  echo "== [sync] branch ${branch}: git pull --rebase =="
  git pull --rebase origin "${branch}"
  remote_exists=1
else
  echo "== [sync] origin/${branch} does not exist yet; skipping pull =="
  remote_exists=0
fi

if git rev-parse --quiet --verify "@{u}" >/dev/null 2>&1; then
  ahead="$(git rev-list --count "@{u}..HEAD")"
else
  ahead=0
fi

if [ "${ahead}" -gt 0 ] || [ "${remote_exists}" -eq 0 ]; then
  echo "== [sync] pushing ${branch} to origin (${ahead} local commit(s) ahead) =="
  git push --set-upstream origin "${branch}"
else
  echo "== [sync] no local commits to push =="
fi

echo "== [sync] complete; current HEAD: $(git rev-parse --short HEAD) =="
