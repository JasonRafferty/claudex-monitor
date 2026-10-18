# Tandem

A small always-on-top desktop widget that shows **Claude Code** and **Codex**
quota side by side: the 5-hour and weekly windows for each, how much is used,
and when each one resets.

## Run it

```bash
npm install
npm start
```

Requirements:

- Node.js 20+
- Claude Code signed in with a Claude subscription (reads `~/.claude/.credentials.json`)
- Codex CLI signed in and on `PATH` (Tandem runs `codex app-server` to read rate limits)

To check both sources without opening the widget:

```bash
npm run check
```

## Using the widget

- Each bar shows how much of that window is used. The thin tick shows how much
  of the window has passed, so a bar past its tick means you are using quota
  faster than the window refreshes it.
- Bars turn amber at 70% and red at 90%.
- The refresh button fetches now; the dropdown sets the interval (30s to 5m).
- The pin keeps the widget above other windows.
- Closing the window hides it. Use the tray icon to bring it back or quit.
- **Ctrl+Alt+M** toggles the widget from anywhere.
- If a fetch fails, the last good figures stay on screen with the error shown
  in red next to the provider name.

Settings (interval, pin) are saved in Electron's user data folder.

## How it gets the numbers

| Provider | Source |
| --- | --- |
| Claude | `GET https://api.anthropic.com/api/oauth/usage` using the OAuth token Claude Code stores locally. The file is re-read every poll, so Claude Code's own token refreshes are picked up. |
| Codex | A short-lived `codex app-server` process, queried over JSON-RPC with `account/rateLimits/read`. |

Both are the same sources the official tools use for their `/usage` displays,
but neither is a documented public API, so they may change.

Environment overrides:

- `CLAUDE_CONFIG_DIR` – Claude config folder (default `~/.claude`)
- `TANDEM_CODEX_PATH` or `CODEX_BIN` – path to the Codex executable

On macOS Claude Code keeps its token in the Keychain rather than the
credentials file, so the Claude half currently needs Linux/WSL or Windows.

## Windows shortcut with WSL

Point a shortcut at:

```
wsl.exe -d Ubuntu --cd /home/jason/code/tandem -- bash scripts/start-widget.sh
```

The script loads nvm if needed, installs dependencies on first run and logs to
`.cache/widget-launch.log`.

## Development

```bash
npm test        # parser tests
npm run check   # live fetch from both providers
```

Layout: `src/main.cjs` (Electron window, tray, polling), `src/claude.cjs` and
`src/codex.cjs` (one fetcher each), `renderer/` (plain HTML/CSS/JS widget).
