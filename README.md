# dsh-auto-exit

<p align="center"><sub><i>本项目由 dsh创造模式 + Deepseek-V4-Flash0731 独立完成</i></sub></p>

[English](README.en.md) | 中文

## 这是什么

`dsh --profile web` 会在终端里长驻一个进程，通过浏览器 Web UI 使用。本插件让
「关掉 Web UI 页面」就等于「退出进程」：所有页面关闭后，CLI 进程自动以等效
Ctrl+C 的方式退出（exit code 130），不用再回终端手动操作。

## 工作原理

1. **检测**：浏览器页面与 CLI 进程之间保持 WebSocket 连接，页面关闭即断开。
2. **宽限**：连接全部断开后等待 15 秒（可配置）再退出——页面刷新、短暂重开
   不会误退；期间重开页面即取消退出。
3. **退出**：宽限期满后调用与 Ctrl+C 相同的优雅退出通道，进程以 exit code 130
   结束，数据与状态照常落盘。

## 安装

```bash
dsh plugin --profile web add dsh-auto-exit
```

或从 GitHub 源安装（等同内容）：

```bash
dsh plugin --profile web add github:xiaxingtianxia2-glitch/dsh-auto-exit
```

## 使用

1. 启动 `dsh --profile web`，用浏览器打开 Web UI（默认 <http://127.0.0.1:3080>）。
2. 直接关闭浏览器标签页/窗口（多个页面需**全部**关闭）。
3. 15 秒后进程自动退出。

### 查看状态

```bash
curl http://127.0.0.1:3080/auto-exit/status
```

```json
{"enabled":true,"armed":true,"sockets":2,"countdownMs":0,"graceSeconds":15,"pollMs":1000,"dryRun":false,"lastEvent":"armed","fired":false}
```

字段含义：`sockets` 当前页面连接数；`countdownMs` 剩余倒计时（0 = 未在倒计时）；
`lastEvent` 最近一次状态变化（idle/armed/lost/cancel/exit）。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `graceSeconds` | `15` | 连接全部断开后等待的秒数再退出 |
| `pollMs` | `1000` | 检测间隔（毫秒） |
| `armAfterFirstConnect` | `true` | 见到首个页面连接后才生效（启动时未开页面不退出） |
| `dryRun` | `false` | 试运行：只记录「将要退出」日志，不真正退出 |

## 常见问题

- **为什么还没退出？** 还有其它页面/标签页开着，或多个浏览器窗口未关；全部
  关闭后才开始倒计时。
- **电脑休眠 / 浏览器崩溃也会退出吗？** 会——连接断开即视为 UI 已不可用；
  如不希望，调大 `graceSeconds`。
- **怎么临时关闭本功能？** 将 `enabled` 配置为 `false`，或卸载插件：
  `dsh plugin --profile web remove dsh-auto-exit`。

## 许可证

[MIT](LICENSE)
