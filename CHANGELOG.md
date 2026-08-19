# Changelog

## 0.0.4 (2026-08-18)

- 修复 4 处审查发现的问题：
  - dryRun 模式触发退出后置 `fired` 防重，不再每秒刷屏日志；
  - `liveSockets` 读取异常返回「无法判定」并跳过本轮，不再按 0 处理（防服务
    异常时误退出）；
  - `toggle` 重新开启看门狗时重置倒计时，避免残留 `lostSince` 导致立即退出；
  - 调用 `appExit` 后加 3s 强制退出保险（覆盖 dispose 后残留句柄导致进程挂起
    的极端场景），确保「等效 Ctrl+C」必然终止。
- `auto_exit` 工具的 `action` 参数加 `enum` 校验。

## 0.0.3 (2026-08-18)

- 修复 peer 范围：`@deepseek-ai/dsh-tools` 改为显式预发布分支
  `>=0.0.1-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0`——旧写法 `>=0.0.1-rc <2`
  会静默排除 `0.1.0-rc.x`（如 DSH 0.1.0-rc.7 的 dsh-tools），用户安装报 ERESOLVE。

## 0.0.2 (2026-08-17)

- 升级为 bundle 形态：package.json 声明 `dsh.bundle` 组合层（`cordis.patch.yml`），
  可通过 `dsh plugin --profile web add dsh-auto-exit` 安装（层栈装配，重启生效）。

## 0.0.1 (2026-08-17)

- 初始发布：关闭 DSH Web UI 自动退出 CLI 进程（等效 Ctrl+C，exit code 130）。
- 功能：WebSocket 连接检测、15s 可配置宽限期（重开页面取消）、`dryRun` 试运行、
  `/auto-exit/status` 状态端点、`auto_exit` 控制工具。
