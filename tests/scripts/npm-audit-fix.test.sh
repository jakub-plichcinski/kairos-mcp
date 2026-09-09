#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
test_root=$(mktemp -d)
trap 'rm -rf "$test_root"' EXIT

mock_npm="${test_root}/npm"

cat > "$mock_npm" <<'MOCK_NPM'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "$MOCK_CALLS"

case "$*" in
  "audit fix")
    if [ "$MOCK_SCENARIO" = "eresolve" ]; then
      echo "npm ERR! code ERESOLVE"
      exit 1
    fi
    if [ "$MOCK_SCENARIO" = "standard" ]; then
      echo standard > "$MOCK_STATE"
    fi
    echo "standard audit fix completed"
    ;;
  "audit fix --force")
    echo force > "$MOCK_STATE"
    echo "force audit fix completed"
    ;;
  "audit --audit-level=moderate")
    state=""
    [ ! -f "$MOCK_STATE" ] || state=$(<"$MOCK_STATE")
    if [ "$MOCK_SCENARIO" = "needs-force" ] && [ "$state" != "force" ]; then
      echo 'fix available via `npm audit fix --force`'
      exit 1
    fi
    if [ "$MOCK_SCENARIO" = "unfixable" ]; then
      echo "No fix available"
      exit 1
    fi
    echo "found 0 vulnerabilities"
    ;;
  *)
    echo "unexpected npm arguments: $*" >&2
    exit 2
    ;;
esac
MOCK_NPM
chmod +x "$mock_npm"

run_case() {
  local scenario=$1
  local case_dir="${test_root}/${scenario}"
  mkdir -p "$case_dir"
  : > "${case_dir}/calls"
  : > "${case_dir}/output"
  MOCK_SCENARIO="$scenario" \
    MOCK_CALLS="${case_dir}/calls" \
    MOCK_STATE="${case_dir}/state" \
    NPM_BIN="$mock_npm" \
    GITHUB_OUTPUT="${case_dir}/output" \
    AUDIT_LOG_DIR="$case_dir" \
    bash "${repo_root}/scripts/npm-audit-fix.sh"
}

run_case needs-force
grep -Fxq 'mode=force' "${test_root}/needs-force/output"
diff -u <(printf '%s\n' \
  'audit fix' \
  'audit --audit-level=moderate' \
  'audit fix --force' \
  'audit --audit-level=moderate') "${test_root}/needs-force/calls"

run_case standard
grep -Fxq 'mode=standard' "${test_root}/standard/output"
diff -u <(printf '%s\n' \
  'audit fix' \
  'audit --audit-level=moderate') "${test_root}/standard/calls"

run_case eresolve
grep -Fxq 'mode=force' "${test_root}/eresolve/output"
diff -u <(printf '%s\n' \
  'audit fix' \
  'audit fix --force' \
  'audit --audit-level=moderate') "${test_root}/eresolve/calls"

unfixable_dir="${test_root}/unfixable"
mkdir -p "$unfixable_dir"
: > "${unfixable_dir}/calls"
: > "${unfixable_dir}/output"
if MOCK_SCENARIO=unfixable \
  MOCK_CALLS="${unfixable_dir}/calls" \
  MOCK_STATE="${unfixable_dir}/state" \
  NPM_BIN="$mock_npm" \
  GITHUB_OUTPUT="${unfixable_dir}/output" \
  AUDIT_LOG_DIR="$unfixable_dir" \
  bash "${repo_root}/scripts/npm-audit-fix.sh"; then
  echo "unfixable advisories unexpectedly succeeded" >&2
  exit 1
fi
if grep -Fxq 'audit fix --force' "${unfixable_dir}/calls"; then
  echo "force fix ran without npm offering it" >&2
  exit 1
fi

echo "npm audit fix workflow regression tests passed"
