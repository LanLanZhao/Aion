/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function mount(withNative = true) {
  let focus;
  let event;
  let owner;
  let back = 0;
  let removed = 0;
  const disabled = [];
  const completed = [];
  const native = {
    addListener: (_name, callback) => { event = callback; return { remove: () => { removed++; event = undefined; } }; },
    enable: (value) => { owner = value; return Promise.resolve(); },
    disable: (value) => { disabled.push(value); return Promise.resolve(); },
    complete: (value) => { completed.push(value); return Promise.resolve(); },
  };
  const filename = path.resolve(__dirname, '../src/components/navigation/use-predictive-back.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const sandbox = { exports: {}, process: { env: { EXPO_OS: 'android' } }, requestAnimationFrame: callback => callback(), require(name) {
    if (name === 'expo-router') return { useFocusEffect: callback => { focus = callback; } };
    if (name === 'react') return { useRef: value => ({ current: value }), useCallback: callback => callback, useEffect: callback => callback() };
    if (name === 'react-native') return { BackHandler: { addEventListener: (_name, callback) => { event = callback; return { remove: () => { removed++; } }; } } };
    if (name === './predictive-back') return { predictiveBack: withNative ? native : null };
    return require(name);
  } };
  vm.runInNewContext(outputText, sandbox, { filename });
  sandbox.exports.usePredictiveBack('drawer', () => back++);
  const blur = focus();
  return { emit: value => event?.(value), get owner() { return owner; }, get back() { return back; }, get removed() { return removed; }, disabled, completed, blur };
}

test('only a committed gesture for the focused screen returns, exactly once', () => {
  const screen = mount();
  screen.emit({ owner: 'a-stale-project-screen' });
  assert.equal(screen.back, 0);
  // A cancelled gesture emits no commit, so navigation is still unchanged.
  screen.emit({ owner: screen.owner });
  screen.emit({ owner: screen.owner });
  assert.equal(screen.back, 1);
  assert.equal(screen.completed.length, 1);
  screen.blur();
  assert.equal(screen.removed, 1);
  assert.equal(screen.disabled[0], screen.owner);
});

test('Android builds without the optional native module still return via hardware Back', () => {
  const screen = mount(false);
  assert.equal(screen.emit(), true);
  assert.equal(screen.back, 1);
  screen.blur();
  assert.equal(screen.removed, 1);
});
