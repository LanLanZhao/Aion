/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function load(relative, modules = {}, platform = 'android') {
  const filename = path.resolve(__dirname, '..', relative);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const scope = { exports: {}, setTimeout, clearTimeout, setInterval, clearInterval, process: { env: { EXPO_OS: platform } }, require: name => modules[name] ?? require(name) };
  vm.runInNewContext(outputText, scope, { filename });
  return scope.exports;
}

test('reply duration clamps invalid clocks, freezes and separates thinking from generation', () => {
  const { replyDuration } = load('src/components/chat/reply-timing.ts');
  assert.equal(replyDuration({ startedAt: 1000, completedAt: 2500, kind: 'simulated' }, 9000), 1.5);
  assert.equal(replyDuration({ startedAt: 1000, firstTokenAt: 1800, completedAt: 9000, kind: 'thinking' }, 12000), 0.8);
  assert.equal(replyDuration({ startedAt: 1000, kind: 'response' }, 2200), 1.2);
  assert.equal(replyDuration({ startedAt: 3000, completedAt: 2000, kind: 'response' }, 6000), 0);
});

test('reply actions copy/share the complete text, toggle one vote, and invoke native speech/regeneration', async () => {
  const cells = [];
  const cleanups = [];
  let cursor = 0;
  let copied, shared, spoken, regenerated = 0, stopped = 0;
  const state = initial => {
    const index = cursor++;
    if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
    return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
  };
  const modules = {
    react: { useState: state, useRef(initial) { return state({ current: initial })[0]; }, useEffect(effect) { const index = cursor++; if (!(index in cells)) { cells[index] = true; const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } } },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Alert: { alert() {} }, Share: { async share(payload) { shared = payload; } } },
    'lucide-react-native': {}, '@/components/icon': {},
    '@/components/preferences-context': { usePreferences: () => ({ language: 'zh', t: text => text }) },
    'expo-clipboard': { async setStringAsync(text) { copied = text; } },
    'expo-speech': { async stop() { stopped++; }, speak(text, options) { spoken = { text, options }; } },
    './message': {}, './streaming-message': {}, './reply-timing': load('src/components/chat/reply-timing.ts'),
  };
  const { AssistantReply } = load('src/components/chat/assistant-reply.tsx', modules);
  const content = '**完整回复**\n\n第二段。\n```js\nconst answer = 42;\n```';
  const props = { message: { id: 'answer', role: 'assistant', content }, streaming: false, busy: false, onRegenerate() { regenerated++; } };
  const render = () => { cursor = 0; return AssistantReply(props); };
  const find = (node, title) => {
    if (!node || typeof node !== 'object') return;
    if (node.props?.title === title) return node;
    const children = [node.props?.children].flat(Infinity);
    return children.map(child => find(child, title)).find(Boolean);
  };
  const click = async title => { const button = find(render(), title); assert.ok(button, title); button.props.onPress(); await new Promise(resolve => setImmediate(resolve)); };
  await click('复制');
  assert.equal(copied, content);
  await click('分享');
  assert.equal(shared.message, content);
  await click('点赞');
  assert.equal(find(render(), '点赞').props.active, true);
  await click('点踩');
  assert.equal(find(render(), '点赞').props.active, false);
  assert.equal(find(render(), '点踩').props.active, true);
  await click('朗读');
  assert.match(spoken.text, /完整回复/);
  assert.match(spoken.text, /const answer = 42;/);
  assert.equal(spoken.options.language, 'zh-CN');
  await click('停止朗读');
  assert.ok(stopped >= 2);
  await click('重新生成');
  assert.equal(regenerated, 1);
  cleanups.forEach(cleanup => cleanup());
});

test('zero-inset Android composer leaves measured breathing room below its complete outline', () => {
  const modules = {
    react: {}, 'react-native': { View: 'View' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' } },
    'lucide-react-native': {}, '@/components/icon': {}, '@/utils/tailwind': {},
    '@/components/preferences-context': { usePreferences: () => ({ t: text => text }) },
    './chat-context': { useChatContext: () => ({}) },
    './conversation': { useConversationContext: () => ({ promptInputStyle: { bottom: 0 }, onPromptInputLayout() {} }) },
  };
  const { PromptInput } = load('src/components/chat/prompt-input.tsx', modules);
  const tree = PromptInput({ children: 'composer' });
  const style = Object.assign({}, ...tree.props.style);
  assert.equal(style.paddingBottom, 12);
  assert.equal(style.bottom, 0, 'safe area/keyboard offset is applied only once');
  assert.equal(typeof tree.props.onLayout, 'function', 'gap belongs to measured height used by scroll footer');
});

test('a newer reply read invalidates an older pending native stop and its error callback', async () => {
  const pendingStops = [];
  const utterances = [];
  const modules = {
    react: { useState: value => [typeof value === 'function' ? value() : value, () => {}], useRef: value => ({ current: value }), useEffect() {} },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Alert: { alert() {} } },
    'lucide-react-native': {}, '@/components/icon': {},
    '@/components/preferences-context': { usePreferences: () => ({ language: 'zh', t: text => text }) },
    'expo-clipboard': {},
    'expo-speech': { stop: () => new Promise(resolve => pendingStops.push(resolve)), speak: (text, options) => utterances.push({ text, options }) },
    './message': {}, './streaming-message': {}, './reply-timing': load('src/components/chat/reply-timing.ts'),
  };
  const { AssistantReply } = load('src/components/chat/assistant-reply.tsx', modules);
  function read(id) {
    const tree = AssistantReply({ message: { id, role: 'assistant', content: id }, streaming: false, busy: false });
    const visit = node => {
      if (!node || typeof node !== 'object') return;
      if (node.props?.title === '朗读') return node;
      return [node.props?.children].flat(Infinity).map(visit).find(Boolean);
    };
    visit(tree).props.onPress();
  }
  read('A');
  read('B');
  pendingStops[1]();
  await new Promise(resolve => setImmediate(resolve));
  pendingStops[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(utterances.map(item => item.text), ['B'], 'late A must not queue behind the newer B');
  read('C');
  pendingStops[2]();
  await new Promise(resolve => setImmediate(resolve));
  const stopsBefore = pendingStops.length;
  utterances[0].options.onError();
  assert.equal(pendingStops.length, stopsBefore, 'an obsolete B error must not stop C');
});
