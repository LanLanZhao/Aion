/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function loadFile(relativePath, imports = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const sandbox = { exports: {}, require: (name) => imports[name] ?? require(name) };
  vm.runInNewContext(outputText, sandbox, { filename });
  return sandbox.exports;
}

const attachments = loadFile('../src/components/chat/attachments.ts');
const projects = loadFile('../src/components/projects/project-model.ts', {
  '@/components/chat/attachments': attachments,
});
const file = (id, size = 1024) => ({ id, name: `${id}.png`, mediaType: 'image/png', size, uri: `file:///cache/${id}.png` });

test('project names, instructions and file limits are enforced', () => {
  assert.deepEqual({ ...projects.validateProject('  Notes  ', '  Be concise  ', []) }, { name: 'Notes', instructions: 'Be concise' });
  assert.throws(() => projects.validateProject('  ', '', []), /项目名称/);
  assert.throws(() => projects.validateProject('a'.repeat(81), '', []), /80/);
  assert.throws(() => projects.validateProject('Notes', 'x'.repeat(4001), []), /4000/);
  assert.throws(() => projects.validateProject('Notes', '', [file('a'), file('b'), file('c'), file('d'), file('e')]), /4 个/);
  assert.throws(() => projects.validateProject('Notes', '', [file('a', 4 * 1024 * 1024), file('b', 4 * 1024 * 1024), file('c')]), /8 MB/);
});

test('saved projects ignore malformed entries instead of crashing the list', () => {
  const valid = { id: 'p1', name: 'Notes', instructions: '', files: [file('a')], createdAt: 1 };
  assert.equal(projects.parseProjects('not-json').length, 0);
  assert.equal(projects.parseProjects(JSON.stringify([valid, { id: 'bad', name: 4 }])).length, 1);
});
