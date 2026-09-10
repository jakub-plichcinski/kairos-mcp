#!/usr/bin/env bash

set -euo pipefail

: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"

npm_bin=${NPM_BIN:-npm}
log_dir=${AUDIT_LOG_DIR:-.local/npm-audit-fix}
fix_log="${log_dir}/audit-fix.txt"
after_standard_log="${log_dir}/audit-after-standard.txt"

mkdir -p "$log_dir"

write_mode() {
  printf 'mode=%s\n' "$1" >> "$GITHUB_OUTPUT"
}

set +e
"$npm_bin" audit fix 2>&1 | tee "$fix_log"
standard_status=${PIPESTATUS[0]}
set -e

force_needed=false
force_reason=""

if [ "$standard_status" -ne 0 ]; then
  if grep -Eq '(^|[^[:alnum:]_])ERESOLVE([^[:alnum:]_]|$)|npm audit fix --force' "$fix_log"; then
    force_needed=true
    force_reason="the standard fix could not resolve the dependency tree"
  else
    exit "$standard_status"
  fi
else
  set +e
  "$npm_bin" audit --audit-level=moderate 2>&1 | tee "$after_standard_log"
  audit_status=${PIPESTATUS[0]}
  set -e

  if [ "$audit_status" -eq 0 ]; then
    write_mode standard
    exit 0
  fi

  if grep -Fq 'npm audit fix --force' "$after_standard_log"; then
    force_needed=true
    force_reason="fixable moderate-or-higher advisories remain after the standard fix"
  else
    echo "::error::Moderate-or-higher advisories remain, but npm did not offer a force fix."
    exit "$audit_status"
  fi
fi

if [ "$force_needed" = true ]; then
  echo "${force_reason}; retrying with npm audit fix --force."
  set +e
  "$npm_bin" audit fix --force 2>&1 | tee -a "$fix_log"
  force_status=${PIPESTATUS[0]}
  set -e
  [ "$force_status" -eq 0 ] || exit "$force_status"
fi

"$npm_bin" audit --audit-level=moderate
write_mode force
