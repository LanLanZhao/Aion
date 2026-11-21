/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function load(relative, modules) {
  const filename = path.resolve(__dirname, '../', relative);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const sandbox = { exports: {}, process: { env: { EXPO_OS: 'android' } }, setTimeout, clearTimeout,
    requestAnimationFrame: callback => { callback(); return 0; },
    require: name => modules[name] ?? require(name),
  };
  vm.runInNewContext(outputText, sandbox, { filename });
  return sandbox.exports;
}

function useSettingsBackHarness(destination, canGoBack = true) {
  const calls = [];
  let registeredTarget;
  const { useSettingsBack } = load('src/components/navigation/use-settings-back.ts', {
    react: { useCallback: callback => callback },
    'expo-router': { useRouter: () => ({ canGoBack: () => canGoBack, back: () => calls.push('back'), dismissTo: path => calls.push(`dismiss:${path}`), replace: path => calls.push(`replace:${path}`) }) },
    '@/components/drawer-content': { useDrawer: () => ({ openDrawerImmediately: () => calls.push('drawer') }) },
    './use-predictive-back': { usePredictiveBack: target => { registeredTarget = target; } },
  });
  useSettingsBack(destination)();
  return { calls, target: registeredTarget };
}

test('settings and directly opened capabilities return to the drawer even with nested navigator history', () => {
  const result = useSettingsBackHarness('drawer');
  assert.deepEqual(result.calls, ['dismiss:/', 'drawer']);
  assert.equal(result.target, 'drawer');
});

test('capabilities, profile and language opened inside settings return one level without opening the drawer', () => {
  const result = useSettingsBackHarness('settings');
  assert.deepEqual(result.calls, ['back']);
  assert.equal(result.target, 'settings');
  assert.deepEqual(useSettingsBackHarness('settings', false).calls, ['replace:/(settings)/settings']);
});

test('a settings search closes its keyboard before capturing the full-size return preview', async () => {
  const calls = [];
  let didHide;
  const { captureBackDestination } = load('src/components/navigation/predictive-back.ts', {
    expo: { requireOptionalNativeModule: () => ({ captureDestination: key => { calls.push(`capture:${key}`); return Promise.resolve(true); } }) },
    'react-native': { Keyboard: { isVisible: () => true, dismiss: () => calls.push('dismiss-keyboard'), addListener: (_name, callback) => { didHide = callback; return { remove: () => calls.push('remove-listener') }; } } },
  });
  const pending = captureBackDestination('settings');
  assert.deepEqual(calls, ['dismiss-keyboard']);
  didHide();
  await pending;
  assert.deepEqual(calls, ['dismiss-keyboard', 'remove-listener', 'capture:settings']);
});
