/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function mountProfile() {
  const cells = [];
  let cursor = 0;
  let profile = { name: 'Chiullian', nickname: 'Chiullian', preferences: '' };
  const writes = [];
  const modules = {
    react: {
      useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = value; }]; },
      useRef(initial) { const i = cursor++; return cells[i] ??= { current: initial }; },
      useEffect(callback, deps) { const i = cursor++; if (!cells[i] || deps.some((dep, j) => dep !== cells[i][j])) { cells[i] = deps; callback(); } },
    },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/components/settings-ui': { SettingsCard: 'SettingsCard', SettingsSection: 'SettingsSection' },
    '@/components/preferences-context': { usePreferences: () => ({
      profile, t: value => value,
      updateProfile: patch => new Promise(resolve => { writes.push({ patch, complete() { profile = { ...profile, ...patch }; resolve(); } }); }),
    }) },
  };
  const filename = path.resolve(__dirname, '../src/app/(settings)/profile.tsx');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const sandbox = { exports: {}, require: name => modules[name] ?? require(name) };
  vm.runInNewContext(output, sandbox, { filename });
  let nodes;
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object' || !node.props) return;
    nodes.push(node);
    visit(node.props.children);
  }
  return {
    writes,
    render() { cursor = 0; nodes = []; visit(sandbox.exports.default()); },
    input(label) { return nodes.find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label); },
    inputs() { return nodes.filter(node => node.type === 'TextInput'); },
    press(label) {
      const button = nodes.find(node => node.type === 'Pressable' && node.props.children?.props?.children === label);
      assert.ok(button, `button ${label} exists`);
      button.props.onPress();
    },
  };
}

for (const scenario of [
  { field: 'Full name', key: 'name', button: 'Update profile' },
  { field: 'Personal preferences', key: 'preferences', button: 'Save preferences' },
]) {
  test(`saving ${scenario.key} locks all profile inputs until completion and permits a later edit`, async () => {
    const app = mountProfile();
    app.render();
    app.input(scenario.field).props.onChangeText('A');
    app.render();
    app.press(scenario.button);
    app.render();
    assert.equal(app.writes.length, 1);
    assert.equal(app.writes[0].patch[scenario.key], 'A');
    for (const input of app.inputs()) {
      assert.equal(input.props.editable, false, `${input.props.accessibilityLabel} must be locked while A is saving`);
    }
    app.writes[0].complete();
    await new Promise(resolve => setImmediate(resolve));
    app.render();
    for (const input of app.inputs()) assert.equal(input.props.editable, true);
    app.input(scenario.field).props.onChangeText('B');
    app.render();
    app.press(scenario.button);
    assert.equal(app.writes.length, 2);
    assert.equal(app.writes[1].patch[scenario.key], 'B');
    app.writes[1].complete();
    await new Promise(resolve => setImmediate(resolve));
  });
}
