#!/usr/bin/env bash
# Run from WSL: creates a "Claudex Monitor" shortcut on the Windows desktop
# that starts the widget without leaving a console window open.
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
distro=${WSL_DISTRO_NAME:?Run this from inside WSL}

local_appdata=$(powershell.exe -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')
install_dir="$local_appdata\\ClaudexMonitor"
install_dir_wsl=$(wslpath "$install_dir")
mkdir -p "$install_dir_wsl"

cp "$repo_root/assets/icon.ico" "$install_dir_wsl/claudex-monitor.ico"
printf '%s\r\n' \
  'Set shell = CreateObject("WScript.Shell")' \
  "shell.Run \"C:\\Windows\\System32\\wsl.exe -d $distro --cd $repo_root -- bash scripts/start-widget.sh\", 0, False" \
  > "$install_dir_wsl/launch-widget.vbs"

powershell.exe -NoProfile -Command "
  \$desktop = [Environment]::GetFolderPath('Desktop')
  \$link = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path \$desktop 'Claudex Monitor.lnk'))
  \$link.TargetPath = \"\$env:SystemRoot\\System32\\wscript.exe\"
  \$link.Arguments = '\"$install_dir\\launch-widget.vbs\"'
  \$link.IconLocation = '$install_dir\\claudex-monitor.ico,0'
  \$link.Description = 'Start Claudex Monitor'
  \$link.Save()
  Write-Host \"Created \$(Join-Path \$desktop 'Claudex Monitor.lnk')\"
"
