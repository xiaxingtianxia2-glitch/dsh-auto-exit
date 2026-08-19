/**
 * dsh-auto-exit — 关闭 DSH Web UI 自动退出 CLI 进程（等效 Ctrl+C）。
 *
 * 原理
 * ----
 * 浏览器页面与 host 保持两条 WebSocket 下行通道（/api/events.mux 与
 * /api/events.host），连接期间其底层 socket 登记在 webServer.upgradedSockets。
 * 页面关闭 / 浏览器窗口关闭 / 标签页崩溃都会让这些 socket 断开。
 * 本插件轮询该集合：见到首个连接后「武装」；全部断开并持续 graceSeconds
 * 秒后调用 ctx.appExit(130) —— 与 Ctrl+C（SIGINT → exit 130）同一条优雅
 * 退出通道（dispose 整棵树后以 130 结束进程，内部自带 5s 强制退出兜底）。
 * 倒计时内重开页面（socket 恢复）即取消退出。
 *
 * 形态
 * ----
 * 标准 DSH cordis 插件包：`dsh plugin --profile web add` 安装（配置热更新即
 * 生效）。依赖（cordis / schemastery / @deepseek-ai/dsh-tools）通过
 * peerDependencies 声明，由 dsh 运行时的 profile 闭包解析。
 *
 * 状态机
 * ----
 *   [未武装] --首个连接--> [武装/连接中] --全部断开--> [倒计时] --超时--> exit(130)
 *                              ^                       |
 *                              +----连接恢复（取消）----+
 */
import z from 'schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-auto-exit'

/** 需要 webServer（观察升级 socket）与 timer（ctx.setInterval，fiber 自动清理）。 */
export const inject = ['webServer', 'timer']

export const Config = z.object({
  /** 总开关：false 时看门狗完全不工作 */
  enabled: z.boolean().default(true),
  /** 连接全部断开后等待多少秒再退出（页面刷新 / 重开窗口的缓冲期） */
  graceSeconds: z.number().min(1).default(15),
  /** 轮询间隔（毫秒） */
  pollMs: z.number().min(200).default(1000),
  /** true = 见到首个连接后才武装（服务刚启动、浏览器未开时不退出） */
  armAfterFirstConnect: z.boolean().default(true),
  /** true = 只记录“将要退出”日志，不真正退出（安全试运行） */
  dryRun: z.boolean().default(false),
})

/** Ctrl+C（SIGINT）的进程退出码：128 + 2 */
const EXIT_CODE = 130

export function apply(ctx, config) {
  const short = '[dsh-auto-exit]'
  const log = (level, ...args) => ctx.logger?.[level]?.(short + ' ' + args[0], ...args.slice(1))

  // ── 运行时状态 ──────────────────────────────────────────────────────────
  let runtimeEnabled = config.enabled        // 工具可运行时启停
  let armed = config.enabled && !config.armAfterFirstConnect // 默认先见连接再武装
  let lostSince = 0                          // 0 = 存在连接；>0 = 连续零连接的起始时间戳
  let fired = false                          // 已触发退出（防重）
  let lastEvent = 'idle'                     // 最近一次状态迁移（观测/排障用）

  function liveSockets() {
    try {
      const sockets = ctx.webServer?.upgradedSockets
      return sockets ? sockets.size : null // 服务不可达 = 无法判定（不按 0 处理，防误退）
    } catch {
      return null
    }
  }

  function statusPayload() {
    return {
      enabled: runtimeEnabled,
      armed,
      sockets: liveSockets(),
      countdownMs: lostSince === 0 ? 0 : Math.max(0, config.graceSeconds * 1000 - (Date.now() - lostSince)),
      graceSeconds: config.graceSeconds,
      pollMs: config.pollMs,
      dryRun: config.dryRun,
      lastEvent,
      fired,
    }
  }

  function exitLikeCtrlC(forceDry = false) {
    const msg = 'Web UI 已关闭，退出进程（等效 Ctrl+C，exit code ' + EXIT_CODE + '）'
    if (forceDry) {
      // test 动作：每次都可重复模拟，不设防重
      lastEvent = 'exit(dryRun)'
      log('warn', msg + ' [test 模拟：不真正退出]')
      return
    }
    if (fired) return
    fired = true
    if (config.dryRun) {
      // 配置级 dryRun：置 fired 防重，避免每秒刷屏
      lastEvent = 'exit(dryRun)'
      log('warn', msg + ' [dryRun：仅模拟，不真正退出]')
      return
    }
    lastEvent = 'exit'
    log('info', msg)
    const exit = ctx.get('appExit')
    if (typeof exit === 'function') {
      exit(EXIT_CODE)
      // 保险：appExit 是优雅退出（exitCode），若 dispose 后事件循环残留句柄，
      // 3s 后强制退出，确保「等效 Ctrl+C」必然终止进程
      setTimeout(() => process.exit(EXIT_CODE), 3000).unref?.()
    } else process.exit(EXIT_CODE)
  }

  function tick() {
    try {
      if (!runtimeEnabled) return
      const count = liveSockets()
      if (count === null) return // 无法判定连接状态，跳过本轮（防误退）

      if (!armed) {
        if (count > 0) {
          armed = true
          lastEvent = 'armed'
          log('info', '已武装：检测到 Web UI 连接（%d 个 socket）；关闭全部 UI 后 %ds 内无连接将退出进程（等效 Ctrl+C，期间重开页面可取消）', count, config.graceSeconds)
        }
        return
      }

      if (count > 0) {
        if (lostSince !== 0) {
          lostSince = 0
          lastEvent = 'cancel'
          log('info', '连接恢复（%d 个 socket），取消退出倒计时', count)
        }
        return
      }

      const now = Date.now()
      if (lostSince === 0) {
        lostSince = now
        lastEvent = 'lost'
        log('warn', 'Web UI 连接全部断开，%ds 后退出进程（等效 Ctrl+C；期间重开页面可取消）', config.graceSeconds)
        return
      }
      if (now - lostSince >= config.graceSeconds * 1000) exitLikeCtrlC()
    } catch (err) {
      log('warn', '轮询异常: ' + String(err))
    }
  }

  ctx.setInterval(tick, config.pollMs)
  log('info', '启动（enabled=%s grace=%ds poll=%dms dryRun=%s）', String(runtimeEnabled), config.graceSeconds, config.pollMs, String(config.dryRun))

  // ── HTTP 状态端点（浏览器/curl 可直接查看，如 http://127.0.0.1:3080/auto-exit/status）──
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/auto-exit/status',
    handler: async (_req, res) => {
      const body = JSON.stringify(statusPayload())
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(body)
    },
  }), 'dsh-auto-exit: status route')

  // ── 控制工具（可选：tools 服务不在时跳过，看门狗核心不受影响）────────────
  const tools = ctx.get('tools')
  if (tools) {
    ctx.effect(() => tools.register(defineTool({
      name: 'auto_exit',
      description: 'dsh-auto-exit 看门狗（Web UI 关闭自动退出 CLI）：status 查询 / toggle 启停 / test 模拟触发（不真正退出）',
      parameters: {
        action: { type: 'string', required: true, description: 'status | toggle | test', enum: ['status', 'toggle', 'test'] },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: String(value) }],
      },
      async execute(args) {
        const action = String(args?.action ?? 'status')
        if (action === 'toggle') {
          runtimeEnabled = !runtimeEnabled
          if (runtimeEnabled) lostSince = 0 // 重新开启时重置倒计时，避免立即触发退出
        }
        if (action === 'test') {
          exitLikeCtrlC(true)
          return 'test 完成（dryRun 模拟，进程未退出）'
        }
        return JSON.stringify(statusPayload())
      },
    })), 'dsh-auto-exit: control tool')
  }
}
