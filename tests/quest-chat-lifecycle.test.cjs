/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function mount() {
  const cells = [];
  let cursor = 0;
  const cleanups = [];
  let writes = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; writes++; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
    useMemo(factory) { const i = cursor++; if (!(i in cells)) cells[i] = factory(); return cells[i]; },
    useCallback: fn => fn,
    useEffect(effect) { const i = cursor++; if (!(i in cells)) { cells[i] = true; const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
  };
  function loadFile(filename, extra = '') {
    const source = fs.readFileSync(filename, 'utf8') + extra;
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
    const sandbox = { exports: {}, AbortController, URL, console, __DEV__: true, process: { env: { EXPO_PUBLIC_MOCK_AI: '1', EXPO_OS: 'android' } }, setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 1)), clearTimeout,
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === '@/components/chat') return { createStreamingStore: loadFile(path.resolve(__dirname, '../src/components/chat/streaming-store.ts')).createStreamingStore };
        if (name === 'expo-haptics') return { impactAsync() {}, notificationAsync() {}, ImpactFeedbackStyle: {}, NotificationFeedbackType: {} };
        return {};
      },
    };
    vm.runInNewContext(outputText, sandbox, { filename });
    return sandbox.exports;
  }
  const module = loadFile(path.resolve(__dirname, '../src/app/index.tsx'), '\nexports.__mock = useMockChat;');
  const render = () => { cursor = 0; return module.__mock(); };
  return { render, dispose: () => cleanups.forEach(fn => fn()), writes: () => writes };
}

test('clearing an active mock stream removes input and cannot resurrect a response', async () => {
  const app = mount();
  app.render().setInput('private draft');
  const generating = app.render().onSend();
  app.render().clear();
  await generating;
  const result = app.render();
  assert.equal(result.input, '');
  assert.equal(result.isGenerating, false);
  assert.equal(result.streamingStore.get(), '');
  assert.equal(result.messages.length, 0);
  assert.equal(Object.hasOwn(result.messages, '-1'), false, 'stale completion must not write into an emptied message array');
  app.dispose();
});

test('clearing an unsent private draft discards the draft', () => {
  const app = mount();
  app.render().setInput('sensitive unsent text');
  app.render().clear();
  assert.equal(app.render().input, '');
  app.dispose();
});

test('a generation finishing after unmount does not write state', async () => {
  const app = mount();
  app.render().setInput('message');
  const generating = app.render().onSend();
  app.dispose();
  const writes = app.writes();
  await generating;
  assert.equal(app.writes(), writes);
});

test('regeneration replaces only the final assistant and preserves its user message', async () => {
  const app = mount();
  app.render().setInput('保留这个问题');
  await app.render().onSend();
  const previous = app.render().messages;
  assert.equal(typeof app.render().regenerate, 'function');
  await app.render().regenerate(previous.at(-1).id);
  const result = app.render();
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].id, previous[0].id);
  assert.equal(result.messages[0].content, '保留这个问题');
  assert.notEqual(result.messages[1].id, previous[1].id);
  assert.ok(result.messages[1].timing.completedAt >= result.messages[1].timing.startedAt);
  assert.equal(result.messages[1].timing.kind, 'simulated');
  assert.match(result.messages[1].content, /[\u4e00-\u9fff]/, 'default mock replies follow Chinese UI');
  app.dispose();
});

test('regeneration does not discard a newly typed draft and an obsolete reply cannot be regenerated', async () => {
  const app = mount();
  app.render().setInput('first');
  await app.render().onSend();
  const firstId = app.render().messages.at(-1).id;
  app.render().setInput('second');
  await app.render().onSend();
  app.render().setInput('unsent draft');
  const before = app.render().messages;
  assert.equal(typeof app.render().regenerate, 'function');
  await app.render().regenerate(firstId);
  assert.equal(app.render().messages, before);
  await app.render().regenerate(before.at(-1).id);
  assert.equal(app.render().input, 'unsent draft');
  assert.equal(app.render().messages.length, 4);
  app.dispose();
});
