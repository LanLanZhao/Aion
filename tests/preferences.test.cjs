/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
function load(name) {
  const filename = path.resolve(__dirname, '../src/utils/', name + '.ts');
  if (!fs.existsSync(filename)) return {};
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const sandbox = { exports: {} };
  vm.runInNewContext(output, sandbox, { filename });
  return sandbox.exports;
}
test('Chinese translates UI keys, English preserves keys, unknown user text is untouched', () => {
  const { translate } = load('i18n');
  assert.equal(typeof translate, 'function');
  assert.equal(translate('zh', 'Settings'), '设置');
  assert.equal(translate('en', 'Settings'), 'Settings');
  assert.equal(translate('zh', 'My own chat title'), 'My own chat title');
  assert.equal(translate('en', '正在读取附件…'), 'Reading attachments…');
});
test('missing, malformed and unsupported saved preferences safely default to Chinese and Chiullian', () => {
  const { parsePreferences } = load('preferences');
  assert.equal(typeof parsePreferences, 'function');
  for (const raw of [null, '', '{broken', 'null', '[]', '{"language":"fr","profile":{"name":42}}']) {
    const parsed = parsePreferences(raw);
    assert.equal(parsed.language, 'zh');
    assert.equal(parsed.profile.name, 'Chiullian');
  }
});
test('saved English and edited profile round trip without translating profile content', () => {
  const { parsePreferences } = load('preferences');
  assert.equal(typeof parsePreferences, 'function');
  const profile = { name: '用户姓名', nickname: 'Alice', preferences: 'I write code.' };
  const parsed = parsePreferences(JSON.stringify({ language: 'en', profile }));
  assert.equal(parsed.language, 'en');
  assert.equal(JSON.stringify(parsed.profile), JSON.stringify(profile));
});
