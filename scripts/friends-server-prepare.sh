#!/usr/bin/env bash
# Read-only diagnostics plus a private backup. No credentials printed.
set -euo pipefail
umask 077
if [ "$(id -u)" != 0 ]; then
  printf 'Please run from the existing root Workbench session.\n' >&2
  exit 1
fi
app=/opt/shenyuan
release=/opt/runae-friends/release-tFIqkq
runtime=/opt/runae-runtime/node-v24.11.0-linux-x64/bin/node
test -d "$app/.git"
test -f "$release/scripts/test-friends.cjs"
test -x "$runtime"
test -f /etc/caddy/Caddyfile
base=$(git -C "$app" rev-parse HEAD)
if [ "$base" != e7e465d31e1aabfce68f344a7ea825e5a614fe40 ]; then
  printf 'STOP: original app revision changed; inspect before deployment.\n' >&2
  exit 1
fi
backup=$(mktemp -d /root/runae-backup.XXXXXX)
git -C "$app" diff --binary HEAD -- > "$backup/local-changes.patch"
cp -a /etc/caddy/Caddyfile "$backup/Caddyfile"
mkdir "$backup/original-code"
for file in server/index.js server/lib/store.js server/routes/divination.js server/package.json server/package-lock.json; do
  if [ -f "$app/$file" ]; then
    mkdir -p "$backup/original-code/$(dirname "$file")"
    cp -a "$app/$file" "$backup/original-code/$file"
  fi
done
printf '\nBACKUP_DIRECTORY=%s\n' "$backup"
printf 'BACKUP_SCOPE=tracked changes, selected original code, Caddy config; NOT a live account database backup\n'
printf 'RELEASE_DIRECTORY=%s\n' "$release"
printf 'ISOLATED_NODE='
"$runtime" --version
printf '\nDISK_SPACE\n'
df -h /
printf '\nSSH_BASE_SETTINGS (Match rules may override these)\n'
if command -v sshd >/dev/null 2>&1; then
  if sshd -T > "$backup/sshd-settings.txt" 2> "$backup/sshd-check-error.txt"; then
    awk '$1 == "pubkeyauthentication" || $1 == "passwordauthentication" || $1 == "permitrootlogin" {print}' "$backup/sshd-settings.txt"
  else
    printf 'SSH settings unavailable; error retained in private backup.\n'
  fi
else
  printf 'sshd command not found\n'
fi
if [ -s /root/.ssh/authorized_keys ]; then
  printf 'ROOT_AUTHORIZED_KEYS_FILE=present (keys not printed)\n'
else
  printf 'ROOT_AUTHORIZED_KEYS_FILE=absent or empty\n'
fi
printf '\nDONE: password, SSH service, PM2, Caddy and live application unchanged.\n'
