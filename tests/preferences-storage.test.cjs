/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

// Native filesystem and React lifecycle are adapter boundaries; execute the real
// provider's queued read/merge/write flow with controllable disk completion.
function mount({ raw = null, read, failWrite = false } = {}) {
  const cells = [];
  let cursor = 0;
  let mountedEffect = false;
  let saved = raw;
  const alerts = [];
  const react = {
    createContext: () => function Context() {},
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = value; }]; },
    useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useEffect(fn) { if (!mountedEffect) { mountedEffect = true; fn(); } },
  };
  const modules = {
    react,
    'react-native': { Alert: { alert: (...values) => alerts.push(values) } },
    'expo-file-system': {
      Paths: { document: 'document' },
      File: class File {
        get exists() { return read !== undefined || saved !== null; }
        text() { return read ? read() : Promise.resolve(saved); }
        write(value) { if (failWrite) throw new Error('Disk full'); saved = value; }
      },
    },
  };
  function load(relative) {
    const filename = path.resolve(__dirname, '../', relative);
    const outputText = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const sandbox = { exports: {}, process: { env: { EXPO_OS: 'android' } },
      require: name => modules[name] ?? (name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : require(name)),
    };
    vm.runInNewContext(outputText, sandbox, { filename });
    return sandbox.exports;
  }
  const { PreferencesProvider } = load('src/components/preferences-context.tsx');
  return {
    render() { cursor = 0; return PreferencesProvider({ children: null }).props.value; },
    get saved() { return JSON.parse(saved); }, alerts,
  };
}

test('language selection during startup preserves a delayed saved profile and survives remount', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const app = mount({ read: () => pending });
  const initial = app.render();
  assert.equal(initial.language, 'zh');
  const selection = initial.setLanguage('en');
  release(JSON.stringify({ language: 'zh', profile: { name: 'Saved name', nickname: 'Saved nick', preferences: 'My writing style' } }));
  await selection;
  assert.equal(app.render().language, 'en');
  assert.equal(app.saved.profile.name, 'Saved name');
  assert.equal(app.saved.profile.preferences, 'My writing style');
  const next = mount({ raw: JSON.stringify(app.saved) });
  const nextInitial = next.render();
  // Also exercise the real profile merge against reloaded English preferences.
  await nextInitial.updateProfile({ nickname: 'Updated nick' });
  assert.equal(next.render().language, 'en');
  assert.equal(next.saved.profile.name, 'Saved name');
  assert.equal(next.saved.profile.nickname, 'Updated nick');
});

test('concurrent language and profile saves merge without dropping either change', async () => {
  const app = mount();
  const initial = app.render();
  await Promise.all([initial.setLanguage('en'), initial.updateProfile({ name: 'Edited name' })]);
  assert.equal(app.saved.language, 'en');
  assert.equal(app.saved.profile.name, 'Edited name');
  assert.equal(app.render().profile.name, 'Edited name');
});

test('a failed preference write rejects, alerts and leaves the visible value unchanged', async () => {
  const app = mount({ failWrite: true });
  const initial = app.render();
  await assert.rejects(initial.setLanguage('en'), /Disk full/);
  assert.equal(app.render().language, 'zh');
  assert.equal(app.alerts.length, 1);
  assert.equal(app.alerts[0][0], '无法保存');
});
