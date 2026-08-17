# dsh-auto-exit

<p align="center"><sub><i>This project was independently completed by dsh Creation Mode + Deepseek-V4-Flash0731</i></sub></p>

English | [中文](README.md)

## What is this?

`dsh --profile web` keeps a long-running process in your terminal, driven from a
browser Web UI. This plugin makes **closing the Web UI equivalent to exiting the
process**: once every page is closed, the CLI process exits automatically through
the same graceful shutdown path as Ctrl+C (exit code 130) — no need to go back to
the terminal.

## How it works

1. **Detection** — the browser page keeps WebSocket connections to the CLI
   process; closing the page drops them.
2. **Grace period** — after all connections are lost, it waits 15 seconds
   (configurable) before exiting, so a quick refresh or reopen never kills the
   process; reopening the page cancels the exit.
3. **Exit** — when the grace period expires, it uses the same graceful shutdown
   channel as Ctrl+C and the process ends with exit code 130, saving state as usual.

## Install

```bash
dsh plugin --profile web add dsh-auto-exit
```

Or from the GitHub source (identical content):

```bash
dsh plugin --profile web add github:xiaxingtianxia2-glitch/dsh-auto-exit
```

## Usage

1. Start `dsh --profile web` and open the Web UI in your browser (default
   <http://127.0.0.1:3080>).
2. Close the browser tab(s)/window(s) (all of them if you have several).
3. The process exits automatically 15 seconds later.

### Check status

```bash
curl http://127.0.0.1:3080/auto-exit/status
```

```json
{"enabled":true,"armed":true,"sockets":2,"countdownMs":0,"graceSeconds":15,"pollMs":1000,"dryRun":false,"lastEvent":"armed","fired":false}
```

Field meanings: `sockets` — current page connections; `countdownMs` — remaining
countdown (0 = not counting down); `lastEvent` — latest state change
(idle/armed/lost/cancel/exit).

## Configuration

| Field | Default | Description |
|---|---|---|
| `enabled` | `true` | Master switch |
| `graceSeconds` | `15` | Seconds to wait after all connections are lost before exiting |
| `pollMs` | `1000` | Poll interval (ms) |
| `armAfterFirstConnect` | `true` | Only arm after the first page connects (a freshly started server with no browser open does not exit) |
| `dryRun` | `false` | Dry run: only log "would exit", never actually exit |

## FAQ

- **Why hasn't it exited yet?** Other tabs/windows are still open — the countdown
  only starts once all connections are gone.
- **Does it exit on laptop sleep or browser crash?** Yes — a dropped connection
  means the UI is no longer usable; increase `graceSeconds` if you don't want that.
- **How do I turn it off temporarily?** Set `enabled` to `false`, or uninstall:
  `dsh plugin --profile web remove dsh-auto-exit`.

## License

[MIT](LICENSE)
