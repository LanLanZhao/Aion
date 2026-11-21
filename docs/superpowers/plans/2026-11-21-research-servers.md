# 科研模块 v1（服务器连接 + 中转）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Quest 抽屉新增「科研」，通过电脑上的 HTTP 中转管理实验服务器连接（新增、列表、测试、删除）。

**Architecture:** 仓库内新增 `relay/`，一个零依赖的 Node HTTP 进程，用系统 `ssh` 测试连接；App 通过 `quest-research.json` 保存中转地址与 token，其余状态从中转的 `/servers` 拉取。

**Tech Stack:** Node 20+（`node:http`/`node:child_process`，无 npm 依赖）· Expo Router · Uniwind/Tailwind · `expo-file-system` · `node:test` + TypeScript 转译测试。

**Spec:** `docs/superpowers/specs/2026-11-21-research-servers-design.md`

## Global Constraints

- 不新增 npm 依赖；中转只用 Node 内置模块。
- 中转不引入 `ssh2`，一律调用系统 `ssh`。
- SSH 凭据只存在于中转；`GET /servers` 不得返回 `keyPath`。
- 所有 shell 调用用参数数组（`spawn`），禁止字符串拼接命令。
- `host`、`user` 不得以 `-` 开头（防止 ssh 选项注入）。
- App 新页面必须复用现有视觉：`bg-muted` 画布、`rounded-[22px] bg-card` 卡片、`px-5` 边距、`t()` 国际化。
- 验证命令：`bun run typecheck`、`bun run test`、`bun run lint`。

## Review Focus

- `host`/`user` 以 `-` 开头时，必须在校验阶段拒绝，绝不能传给 `ssh`。
- 请求体不是 JSON、超大、字段缺失时，中转返回 400 而不是崩溃或挂起。
- 中转不可达或 token 错误时，App 显示可读状态并可重试，不出现无限 loading。
- 电脑上没有 `ssh` 命令、或 SSH 卡在主机指纹提示时，测试连接必须在 8 秒内返回明确错误。
- `/servers` 返回缺字段或多余字段时，App 列表仍能渲染，不整页白屏。

---

### Task 1: 中转的校验、脱敏与 ssh 参数

**Files:**
- Create: `relay/lib/model.mjs`
- Create: `relay/lib/ssh.mjs`
- Test: `tests/research-relay.test.cjs`

**Interfaces:**
- `validateServerInput(input: unknown): {name, host, port, user, keyPath, condaEnv, rootDir}` — 抛 `Error` 带中文原因
- `parseServersFile(raw: string | null): Server[]` — 忽略坏条目
- `redactServer(server): object` — 去掉 `keyPath`，加 `hasKeyPath: boolean`
- `parseSshConfig(raw: string): string[]` — 去重、跳过通配符与注释
- `buildSshTestArgs(server): string[]` — 返回 `ssh` 的参数数组，末段为 `user@host`, `printf`, `ok`

- [ ] **Step 1: 写失败测试**

```js
test('server input is validated and option-like hosts rejected', () => {
  assert.deepEqual(model.validateServerInput({ name: ' 4090 ', host: '10.0.0.5', port: '22', user: ' lanlan ' }),
    { name: '4090', host: '10.0.0.5', port: 22, user: 'lanlan', keyPath: '', condaEnv: '', rootDir: '' });
  assert.throws(() => model.validateServerInput({ name: 'x', host: '-oProxyCommand=calc', user: 'u' }), /Host/);
  assert.throws(() => model.validateServerInput({ name: 'x', host: 'h', user: '-u' }), /用户名/);
  assert.throws(() => model.validateServerInput({ name: '', host: 'h', user: 'u' }), /名称/);
  assert.throws(() => model.validateServerInput({ name: 'x', host: 'h', port: '70000', user: 'u' }), /端口/);
});
test('redaction never returns a key path', () => {
  const out = model.redactServer({ id: 's1', keyPath: '/home/u/.ssh/id_ed25519' });
  assert.equal(out.keyPath, undefined);
  assert.equal(out.hasKeyPath, true);
});
test('ssh config aliases skip wildcards', () => {
  assert.deepEqual(model.parseSshConfig('Host a b\n  HostName x\nHost *\nHost ?\n# Host c\nHost=A\n'), ['a', 'b', 'A']);
});
test('ssh args are an argv array with hardening options', () => {
  const args = ssh.buildSshTestArgs({ host: 'h', port: 2222, user: 'u', keyPath: '/k' });
  assert.ok(args.includes('BatchMode=yes') && args.includes('StrictHostKeyChecking=accept-new'));
  assert.deepEqual(args.slice(-3), ['u@h', 'printf', 'ok']);
  assert.ok(args.includes('-i'));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/research-relay.test.cjs`
Expected: FAIL，`Cannot find module .../relay/lib/model.mjs`

- [ ] **Step 3: 实现 model.mjs 与 ssh.mjs**

`model.mjs`：`name` trim 后 1–60；`host` 匹配 `/^[A-Za-z0-9._:@-]+$/` 且不以 `-` 开头、≤255；`user` 匹配 `/^[A-Za-z0-9._-]+$/` 且不以 `-` 开头；`port` 默认 22，整数 1–65535；`keyPath`/`condaEnv`/`rootDir` 可选 trim，分别 ≤500/100/500。`parseServersFile` 用 `try/catch`，只保留 id/name/host/user 类型正确的条目。`redactServer` 用剩余字段重建对象。

`ssh.mjs`：`buildSshTestArgs` 返回 `['-p', String(port), '-o','BatchMode=yes','-o','ConnectTimeout=5','-o','StrictHostKeyChecking=accept-new', ...(keyPath ? ['-i', keyPath] : []), `${user}@${host}`, 'printf', 'ok']`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/research-relay.test.cjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add relay/lib/model.mjs relay/lib/ssh.mjs tests/research-relay.test.cjs
git commit -m "feat(relay): validate servers and build hardened ssh args"
```

---

### Task 2: 中转 HTTP 接口与持久化

**Files:**
- Create: `relay/lib/app.mjs`
- Test: `tests/research-relay.test.cjs`（追加）

**Interfaces:**
- `createRelayHandler({ token, dataFile, sshTest?, readSshConfig? }): (req, res) => void`
- `sshTest(server, timeoutMs) => Promise<{ ok, code, message, latencyMs }>`（Task 3 实现，这里先注入假实现）
- `readSshConfig() => Promise<string[]>`

- [ ] **Step 1: 写失败测试**

启动 `http.createServer(createRelayHandler(...))` 监听 0 端口，用 `fetch` 断言：
- 无 token → 401
- `GET /health` → 200 `{ok:true}`
- `POST /servers` 合法 → 201，`GET /servers` 不含 `keyPath`、含 `hasKeyPath`
- `POST /servers` 的 host 为 `-oProxyCommand=x` → 400
- 非法 JSON 请求体 → 400（不是 500/崩溃）
- `DELETE /servers/:id` → 204，再 `GET` 为空
- 未知路径 → 404

数据文件用 `fs.mkdtemp` 建临时目录。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/research-relay.test.cjs`
Expected: FAIL，`createRelayHandler is not a function`

- [ ] **Step 3: 实现 app.mjs**

请求流程：只接受 `Authorization: Bearer <token>`；`/health` 免鉴权（便于先验证地址）。读体上限 64KB，`JSON.parse` 失败返回 400。写文件用 `writeFileSync(tmp)` + `renameSync` 原子替换。`/servers/:id/test` 调注入的 `sshTest`，未知 id 返回 404。加 `Access-Control-Allow-Origin: *`、`Access-Control-Allow-Headers: Authorization, Content-Type`，并处理 `OPTIONS`。所有响应 `Content-Type: application/json; charset=utf-8`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/research-relay.test.cjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add relay/lib/app.mjs tests/research-relay.test.cjs
git commit -m "feat(relay): add authenticated server CRUD API"
```

---

### Task 3: 中转启动入口与 SSH 连接测试

**Files:**
- Create: `relay/index.mjs`
- Modify: `relay/lib/ssh.mjs`（追加 `runSshTest`）
- Modify: `package.json`（新增 `"relay": "node relay/index.mjs"`）
- Modify: `.gitignore`（`relay/relay.config.json`、`relay/data/`）
- Test: `tests/research-relay.test.cjs`（追加 ssh 超时与错误归类）

**Interfaces:**
- `runSshTest(server, timeoutMs = 8000): Promise<{ok, code, message, latencyMs}>`
- `code ∈ 'ok' | 'timeout' | 'refused' | 'auth' | 'dns' | 'ssh_missing' | 'unknown'`
- `loadOrCreateConfig(configPath): {port, host, token}`

- [ ] **Step 1: 写失败测试**

用假 `spawn`（注入）验证：`stderr` 含 `Permission denied` → `code:'auth'`；含 `Connection refused` → `refused`；含 `Could not resolve hostname` → `dns`；子进程一直不退出 → 800ms 内返回 `timeout`；`spawn` 抛 `ENOENT` → `ssh_missing`。再断言 `loadOrCreateConfig` 首次生成 64 位 hex token，第二次读回同一个 token。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/research-relay.test.cjs`
Expected: FAIL，`runSshTest is not a function`

- [ ] **Step 3: 实现**

`runSshTest` 用 `spawn('ssh', args, { windowsHide: true })`，累计 stderr（上限 4KB），`setTimeout` 到时 `kill()` 并返回 `timeout`，退出码 0 → `ok`。错误归类按上面的关键词，`message` 取 stderr 首个非空行（截断 200 字）。

`index.mjs`：config 缺失时生成并打印 token 与局域网地址（`os.networkInterfaces()` 里第一个非内网 IPv4），启动后打印 `http://<ip>:<port>`；`SIGINT` 优雅关闭。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/research-relay.test.cjs`
Expected: PASS

- [ ] **Step 5: 手工冒烟**

Run: `node relay/index.mjs`
Expected: 打印 token 和 `http://<局域网IP>:8787`；另开终端 `curl -H "Authorization: Bearer <token>" http://127.0.0.1:8787/servers` 返回 `{"servers":[]}`。

- [ ] **Step 6: 提交**

```bash
git add relay/index.mjs relay/lib/ssh.mjs package.json .gitignore tests/research-relay.test.cjs
git commit -m "feat(relay): add CLI entry and ssh connection test"
```

---

### Task 4: App 的模型、存储与中转客户端

**Files:**
- Create: `src/components/research/research-model.ts`
- Create: `src/components/research/research-context.tsx`
- Test: `tests/research-model.test.cjs`

**Interfaces:**
- `type RelayConfig = { baseUrl: string; token: string }`
- `type ServerSummary = { id, name, host, port, user, condaEnv, rootDir, hasKeyPath }`
- `type ServerDraft = { name, host, port: number, user, keyPath, condaEnv, rootDir }`
- `normalizeBaseUrl(input: string): string` — 补 `http://`、去尾部 `/`
- `validateRelayConfig(baseUrl: string, token: string): RelayConfig`
- `parseRelayConfig(raw: string | null): RelayConfig | null`
- `validateServerDraft(draft): ServerDraft`（与中转同规则，错误信息中文）
- `parseServersResponse(data: unknown): ServerSummary[]`
- `useResearch(): { relay, servers, ready, loading, error, saveRelay, disconnectRelay, refresh, addServer, deleteServer, testServer }`

- [ ] **Step 1: 写失败测试**

```js
test('relay config normalizes and validates', () => {
  assert.deepEqual(model.validateRelayConfig(' 192.168.1.5:8787/ ', ' abc '), { baseUrl: 'http://192.168.1.5:8787', token: 'abc' });
  assert.equal(model.normalizeBaseUrl('https://lab.example.com/'), 'https://lab.example.com');
  assert.throws(() => model.validateRelayConfig('', 'x'), /中转地址/);
  assert.throws(() => model.validateRelayConfig('http://h:8787', ''), /Token/);
  assert.equal(model.parseRelayConfig('{"baseUrl":"http://h","token":"t"}').token, 't');
  assert.equal(model.parseRelayConfig('nope'), null);
});
test('unknown server fields are tolerated', () => {
  const list = model.parseServersResponse({ servers: [{ id: 's1', name: 'A', host: 'h', port: 22, user: 'u', extra: 1 }, { bad: true }] });
  assert.equal(list.length, 1);
  assert.equal(list[0].condaEnv, '');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/research-model.test.cjs`
Expected: FAIL，模块不存在

- [ ] **Step 3: 实现 model 与 context**

context：用 `File(Paths.document, 'quest-research.json')`，web 用 `localStorage['quest-research-v1']`；加载后若有 relay 立即 `refresh()`。`request()` 用 `AbortController` + 8s 超时，`Authorization: Bearer`，非 2xx 抛带状态码的 Error；网络错误映射为「无法连接中转」。`addServer` POST 后刷新；`testServer` 把返回的 `code` 存进本地 `status` map（`ok/…` + 耗时）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/research-model.test.cjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/research tests/research-model.test.cjs
git commit -m "feat(research): add client model and relay context"
```

---

### Task 5: 科研页面与抽屉入口

**Files:**
- Create: `src/app/research/_layout.tsx`
- Create: `src/app/research/index.tsx`
- Create: `src/app/research/new.tsx`
- Create: `src/app/research/relay.tsx`
- Modify: `src/app/_layout.tsx`（挂 Provider、注册 `research` Stack、接 `onOpenResearch`）
- Modify: `src/components/drawer-content.tsx`（新增行）
- Modify: `src/utils/i18n.ts`（新文案）

**Interfaces:**
- `useResearch` 来自 Task 4

- [ ] **Step 1: 实现四个页面**

- `_layout.tsx`：`Stack`，header 背景用 `useCSSVariable("--app-background")`，`contentStyle` 同色；`index` 标题 `t("Research")`；`new`、`relay` 用 `presentation: "modal"`、`headerShown: false`。
- `index.tsx`：`ScrollView` + `bg-muted`；未配置 relay → 居中空状态（`FlaskConical` 圆底卡片 + 标题 + 说明 + 「配置中转」按钮）；已配置 → 服务器卡片列表。卡片：`rounded-[22px] bg-card px-5 py-4 active:bg-secondary`，左侧 `bg-muted` 圆形 `Server` 图标，中间名称 17px 半粗 + `user@host:port` 13px muted，右侧状态点（绿/灰/红）+ 文案。点按卡片 `testServer`，长按 `Alert` 确认删除。底部一行「中转 http://…」+「管理」链到 `/research/relay`。`RefreshControl` 接 `refresh`。用 `usePredictiveBack("drawer", goBack)` 和 `captureBackDestination("drawer")` 保持返回抽屉的行为（对齐 `projects/index.tsx`）。
- `new.tsx`：顶部 X / 标题 / 保存（对齐 `projects/new.tsx`）；字段分两张卡：「连接」名称、Host（带「从 SSH 配置选择」展开 `/ssh-hosts` 的别名列表）、端口（数字键盘）、用户名、私钥路径（可选）；「实验（可选）」conda 环境、实验根目录。保存失败 `Alert` 显示中文原因。
- `relay.tsx`：中转地址、Token（`secureTextEntry`）、「测试并保存」主按钮（`bg-foreground text-background` 圆角胶囊，同项目详情页）、已配置时显示「断开连接」红色行；底部说明「在电脑上运行 `bun run relay`，地址填电脑的局域网 IP」。
- 抽屉：在 Capabilities 与 Projects 之间加 `FlaskConical` + `t("Research")`；`DrawerContent` 新增 `onOpenResearch`，`_layout.tsx` 里 `captureBackDestination("drawer")` → `closeDrawer()` → `router.navigate("/research")`。
- i18n：新增 `Research`、`Relay`、`Add server`、`Server name`、`Host`、`Port`、`Username`、`Private key path (optional)`、`Conda environment (optional)`、`Experiment root (optional)`、`Test and save`、`Disconnect`、`Test connection`、`Online`、`Offline`、`Not tested`、`Connect a relay first`、`Run bun run relay on your computer...` 等，英文 key + 中文值写入 `chinese`；运行期错误文案用中文常量并在 `english` 里补对应英文。

- [ ] **Step 2: 类型检查与 lint**

Run: `bun run typecheck && bun run lint`
Expected: 0 error（仅允许既有的 warning）

- [ ] **Step 3: 提交**

```bash
git add src/app/research src/app/_layout.tsx src/components/drawer-content.tsx src/utils/i18n.ts
git commit -m "feat(research): add servers list, add-server form and relay setup"
```

---

### Task 6: 回归测试、文档与端到端验证

**Files:**
- Modify: `README.md`（科研模块 + 中转用法）
- Modify: `tests/android-drawer.test.cjs`（若该测试断言 drawer 行数/顺序，则更新）

- [ ] **Step 1: 跑全量验证**

Run: `bun run typecheck && bun run test && bun run lint`
Expected: 全部通过；`node --test tests/*.test.cjs` 含两个新测试文件。

- [ ] **Step 2: 更新 README**

在「功能」下新增「科研」小节：抽屉入口、先起中转、填局域网 IP 与 token、新增服务器、测试连接；说明 v1 不显示曲线、凭据只留在中转。

- [ ] **Step 3: 手工验收**

1. `node relay/index.mjs`，记下 token。
2. 手机与电脑同一 Wi-Fi，App 进入「科研」→「配置中转」→ 填 `http://<电脑IP>:8787` + token →「测试并保存」。
3. 新增服务器，Host 选一个 `~/.ssh/config` 别名，保存。
4. 点卡片测试连接：能登录返回「在线 + 耗时」，错误主机返回可读错误。
5. 长按删除，列表即时更新。

- [ ] **Step 4: 提交**

```bash
git add README.md tests/android-drawer.test.cjs
git commit -m "docs: document research relay setup"
```
