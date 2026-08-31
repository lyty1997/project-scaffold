#!/usr/bin/env bash
# Preview service for the remote Linux host. It manages a sibling
# ../<repository>.preview worktree on demand; it does not run a persistent watcher.
# See docs/architecture/dev-workflow.md.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${script_dir}/dev-workflow.env"
if [ -f "${env_file}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
fi

PORT="${PREVIEW_PORT:?Error: PREVIEW_PORT is not set. Copy scripts/dev/dev-workflow.env.example to dev-workflow.env and configure it, or run scripts/init.mjs}"
PREVIEW_HOST="${PREVIEW_HOST:?Error: PREVIEW_HOST is not set; configure it in the same way as PREVIEW_PORT}"
SERVE_DIR="${PREVIEW_SERVE_DIR:-public}"

repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "${repo_root}")"
preview_dir="$(dirname "${repo_root}")/${repo_name}.preview"
pid_file="${preview_dir}/.preview.pid"
branch_file="${preview_dir}/.preview.branch"
log_file="${preview_dir}/.preview.log"

usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") <serve <branch> | restart [branch] | stop | status>
EOF
  exit 1
}

ensure_preview_worktree() {
  if [ ! -d "${preview_dir}" ]; then
    echo "== [preview] worktree does not exist; creating ${preview_dir} =="
    git -C "${repo_root}" worktree add --detach "${preview_dir}" HEAD
  fi
}

is_running() {
  [ -f "${pid_file}" ] || return 1
  local pid
  pid="$(cat "${pid_file}")"
  [ -n "${pid}" ] || return 1
  kill -0 "${pid}" 2>/dev/null || return 1
  grep -q "http.server" "/proc/${pid}/cmdline" 2>/dev/null || return 1
  return 0
}

# Find the PID listening on ${PORT}, if any.
port_listener_pid() {
  ss -tlnp "( sport = :${PORT} )" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -n1 || true
}

# Confirm that a PID belongs to this preview: it must be an http.server process
# serving this exact directory. This avoids mistaking another server for ours.
pid_is_our_server() {
  local pid="$1"
  [ -n "${pid}" ] || return 1
  grep -q "http.server" "/proc/${pid}/cmdline" 2>/dev/null || return 1
  grep -q -- "${preview_dir}/${SERVE_DIR}" "/proc/${pid}/cmdline" 2>/dev/null || return 1
  return 0
}

checkout_ref() {
  local branch="$1"
  echo "== [preview] git fetch origin ${branch} =="
  git -C "${preview_dir}" fetch origin "${branch}"
  if git -C "${preview_dir}" show-ref --quiet "refs/remotes/origin/${branch}"; then
    git -C "${preview_dir}" checkout --detach "origin/${branch}"
  elif git -C "${preview_dir}" show-ref --quiet "refs/heads/${branch}"; then
    git -C "${preview_dir}" checkout --detach "${branch}"
  else
    echo "Error: branch ${branch} was not found locally or on the remote." >&2
    exit 1
  fi
  echo "${branch}" > "${branch_file}"
}

start_server() {
  # Reject a port owned by another process before starting. Otherwise python3
  # could fail to bind while the unrelated PID is recorded as this preview,
  # causing a later stop or restart to act on a process we do not own.
  local existing
  existing="$(port_listener_pid)"
  if [ -n "${existing}" ] && ! pid_is_our_server "${existing}"; then
    echo "Error: port ${PORT} is owned by process ${existing}, which is not this preview. Free the port or choose another PREVIEW_PORT." >&2
    exit 1
  fi

  echo "== [preview] starting static server on port ${PORT} from ${SERVE_DIR} =="
  # Do not trust $!: when the caller is already a process-group leader, setsid
  # may fork and leave $! pointing at a short-lived wrapper (kill -0 also succeeds
  # for zombies). Resolve the real PID from the listening socket with retries.
  setsid python3 -m http.server -d "${preview_dir}/${SERVE_DIR}" "${PORT}" \
    >"${log_file}" 2>&1 < /dev/null &
  disown 2>/dev/null || true

  local real_pid=""
  for _ in $(seq 1 20); do
    # Under pipefail, grep returns 1 when no match exists. Without `|| true`,
    # set -e would exit here before the retry loop reaches its second attempt.
    real_pid="$(port_listener_pid)"
    # Trust only an http.server process that serves this preview directory.
    if [ -n "${real_pid}" ] && pid_is_our_server "${real_pid}"; then
      break
    fi
    real_pid=""
    sleep 0.2
  done

  if [ -z "${real_pid}" ]; then
    echo "Error: the static server failed to start or could not be confirmed on port ${PORT}. Log output:" >&2
    tail -n 20 "${log_file}" >&2 || true
    exit 1
  fi
  echo "${real_pid}" > "${pid_file}"
  echo "== [preview] started with PID ${real_pid}: http://${PREVIEW_HOST}:${PORT}/ =="
}

stop_server() {
  if is_running; then
    local pid
    pid="$(cat "${pid_file}")"
    echo "== [preview] stopping PID ${pid} =="
    kill -TERM "${pid}" 2>/dev/null || true
    for _ in $(seq 1 10); do
      kill -0 "${pid}" 2>/dev/null || break
      sleep 0.3
    done
    kill -0 "${pid}" 2>/dev/null && kill -KILL "${pid}" 2>/dev/null || true
  fi
  rm -f "${pid_file}"
}

cmd="${1:-}"
case "${cmd}" in
  serve)
    branch="${2:-}"
    [ -n "${branch}" ] || usage
    if is_running; then
      echo "Error: the preview is already running; stop it first or use restart." >&2
      exit 1
    fi
    ensure_preview_worktree
    checkout_ref "${branch}"
    start_server
    ;;
  restart)
    branch="${2:-}"
    ensure_preview_worktree
    if [ -z "${branch}" ]; then
      [ -f "${branch_file}" ] || { echo "Error: no previous branch is recorded; pass a branch explicitly." >&2; exit 1; }
      branch="$(cat "${branch_file}")"
    fi
    checkout_ref "${branch}"
    stop_server
    start_server
    ;;
  stop)
    stop_server
    echo "== [preview] stopped =="
    ;;
  status)
    if is_running; then
      echo "running: PID $(cat "${pid_file}"), branch $(cat "${branch_file}" 2>/dev/null || echo unknown), http://${PREVIEW_HOST}:${PORT}/"
    else
      echo "not running"
    fi
    ;;
  *)
    usage
    ;;
esac
