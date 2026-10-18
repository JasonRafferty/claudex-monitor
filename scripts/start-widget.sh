#!/usr/bin/env bash
set -eo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
mkdir -p "$repo_root/.cache"
exec >>"$repo_root/.cache/widget-launch.log" 2>&1
printf '\nStarting Tandem: %s\n' "$(date -Is)"
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi
fi
if ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js/npm could not be found.'
  exit 1
fi
cd "$repo_root"
[ -d node_modules ] || npm install
exec npm start
