# Botzone 裁判与 renderer 开发

## 边界与数据流

裁判与 Bot 代码由后端 **judge worker** 在独立沙箱中执行；前端只保存/展示代码、发起测试与接收结果，绝不在浏览器或前端服务中执行裁判。下面的 Python 例子是独立的协议示例，浏览器 probe 只 mock API/SSE，**不验证真实 judge**。

1. 裁判按行读取 `{"round": N, "responses": {"0": "<bot stdout>", "1": "<bot stdout>"}}`。首轮 `responses` 为空。
2. 每轮按行输出并 flush `{"commands": {"0": request0, "1": request1}, "display": ..., "verdict": "continue"}`；终局输出 `"verdict": "finish", "scores": {"0": 1, "1": 0}`。只在终局给 scores。Bot 按行接收对应 command，输出并 flush 一行响应。
3. 实际 `GET /compete/matches/:id` 的 `result` 可能是 JSON 字符串；对局 callback 保存 `{verdict, rounds, finalResult, roundCount}`。每个 round 的原始字段可有 `judgeCmd`（包括 `display/content/verdict`）、`botResponses`、`display`、`debug`。不同生产者的字段会有差异，勿假定 `judgeCmd` 必定是纯命令表。
4. `normalizeGameLog(raw, gameId)` (`app/utils/botzone-log.ts`) 对结果做一次纯转换：`judgerDisplay` 优先 `display`、其次 `judgeCmd.display`、再 `judgerDisplay`；`botOutputs` 优先 `botResponses`；保留 `judgeCmd/display/botResponses/debug` 和其他原始字段。无有效 rounds 返回 null。`round` 在 `postMessage` 中是**从零开始的索引**，`rounds[n].round` 是裁判回合号。`finalResult` 是按玩家位置/ID 映射的得分；消费者勿硬编码键的语义。

## iframe 消息协议

平台 → renderer：

- `{type:'gameLog', gameLog, round}`：回放；`gameLog.rounds[round].judgeCmd?.display` 是常见原始显示字段，也可使用归一化后的 `judgerDisplay`。所有原始字段均可查看。
- `{type:'gameState', gameState, playerIndex}`：人类玩家实时出手。`gameState.requests.at(-1)` 常是 JSON 字符串，需安全解析；只应展示该玩家能看到的请求，不将 `turnToken` 传进 iframe。

renderer → 平台：

- 启动时 `{type:'capabilities', interactive:true}` 告知支持交互；只有来源为**当前人类回合 iframe**、且 `interactive` 是布尔值时接受。
- 出手 `{type:'humanMove', move: JSON.stringify({[String(playerIndex)]: moveValue})}`；`move` 是**字符串**，不是对象。平台只接受当前回合自身 iframe 的非空字符串，提交到 `POST /compete/bot-respond`，body 为 `{turnToken, response:move}`。用户手动输入保留为非空字符串回退路径。后端负责验证 turnToken/归属/对局状态，renderer 不能自行授权。

renderer 运行在 `sandbox="allow-scripts"` 的 `srcdoc` iframe；不加 `allow-same-origin`。不可信 HTML 隔离域是不透明 origin，父子间需 `postMessage(..., '*')`，**接收方要核对 `event.source` 和消息形状**。renderer 亦应验证消息来自 `window.parent`。展示来自日志/请求的数据优先 `textContent`，不要把未信任内容拼进 `innerHTML`。无插件加载/额外权限。

## 可运行示例与验证

- `examples/botzone/closest-judge.py`：一轮最接近 5 的裁判；`closest-bot.py`：对应 Bot。下面只本地演示 stdin/stdout 协议，不代表真实 judge 运行：

  ```sh
  printf '%s\n' '{"round":1,"responses":{}}' '{"round":2,"responses":{"0":"{\"move\":5}","1":"{\"move\":4}"}}' | python3 examples/botzone/closest-judge.py
  printf '%s\n' '{"target":5}' | python3 examples/botzone/closest-bot.py
  ```

- `examples/botzone/closest-renderer.html`：粘贴到 Playground → 渲染器，或通过游戏编辑页保存到 `rendererHtml`，处理 `gameLog` 与 `gameState`，点击按钮向父页面发送 move。
- `node scripts/botzone-renderer-probe.mjs`：使用已有 Playwright Chrome channel 启动临时本地 Nuxt，mock auth/match/SSE/提交接口，驱动**实际对局页面**的回放及真人出手沙箱 iframe，验证正向消息、畸形消息和无关 source 拒绝；不连接外部 judge，不增依赖。需要本机 Chrome 与已安装的 pnpm 依赖。

Playground 测裁判：`POST /compete/games/:id/playground-judge` 带 `judgerCode`, `judgerLanguage`, `bot0`, `bot1`；返回 `matchId`，轮询 `GET /compete/matches/:id` 查看 `result`。发布 renderer：`PATCH /compete/games/:id` 的 `rendererHtml`（需要授权）。管理页的本地 iframe 预览应沿用相同两类入站消息，不能当成真正裁判执行结果。

### 集成提醒（Playground / 管理预览）

在它们各自的 JSON 预览发送路径中复用 `normalizeGameLog(parsedInput, gameId)`，若为 null 提示“无有效回合”，否则原样以 `{type:'gameLog', gameLog: normalized, round: 0}` 发给沙箱；对人类回合发送 `{type:'gameState',gameState,playerIndex}`。预览监听 renderer 回传时也只接收当前预览 iframe `contentWindow` 且结构符合 `capabilities`/`humanMove` 的消息；不要打开 `allow-same-origin`，不要把 `humanMove` 从预览发送到真实 `bot-respond`。现有接口 `runPlaygroundJudge/getMatch/updateGame` 已覆盖这条路径，不需新 API。

## CodeBot 教程协议与起步模板

`pnpm test:botzone-templates` 在本机实际编译/执行四语言模板和教程示例，需要 Python 3、Node.js、C++17 编译器与已安装的项目 TypeScript。它验证源码输入/输出，不替代 Docker judge 的资源隔离或真实对局验收；因此没有强制加入仅需 Node 的默认源码回归。

CodeBot 每轮启动为**新进程**，stdin 是 judge 通过 `commands[player]` 交给该玩家的当前 `command`（原始文本或 JSON），不是自动包装的 `requests`/`responses`。进程内全局变量不会跨轮保存；若 bot 需要历史，judge 必须把历史信息写进下轮 command。每个 Bot 的 CPU/内存隔离。

Judge 与 Bot 是两种进程/协议：judge 每轮读 `{round, responses}` 并输出 `{commands, display, verdict, scores?}`；judge 的 `commands` 再成为每名 Bot 的 stdin。不要将此协议与人类/外部 webhook 的 `GameState` `requests`/`responses` 包装混为一谈；该包装不是默认 CodeBot 输入。

可信 fixture `closest-judge.py` / `closest-bot.py` 使用 JSON command `{"target":5}`，对应 bot 读入后输出 `{"move":5}`，预期 move 为 5。模板本身是语言合法的通用脚手架：Python、C++17、Node.js JavaScript、TypeScript（转译到 Node.js），提示解析 command、选择合法 move、输出单行 JSON、flush stdout，调试写 stderr；游戏具体字段仍须遵循该游戏 judge 的合同。

若特定 judge 明确采用 requests wrapper，可另写兼容读取函数；不要把 `requests[-1]` 教作默认协议。Playground 测试是测试交互，不改 ELO；发布本身不保证自动对战或榜单更新，只有符合资格的评级对局才更新 ELO，自动匹配可能由管理员触发。
