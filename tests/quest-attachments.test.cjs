/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function load() {
  const filename = path.resolve(__dirname, '../src/components/chat/attachments.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const sandbox = { exports: {}, require };
  vm.runInNewContext(outputText, sandbox, { filename });
  return sandbox.exports;
}

test('attachment validation rejects unsupported, empty and oversized content', () => {
  const a = load();
  assert.throws(() => a.validateAttachment({ name: 'x.exe', mediaType: 'application/octet-stream', size: 8 }), /不支持/);
  assert.throws(() => a.validateAttachment({ name: 'a.png', mediaType: 'image/png', size: 0 }), /空文件/);
  assert.throws(() => a.validateAttachment({ name: 'a.png', mediaType: 'image/png', size: a.MAX_ATTACHMENT_BYTES + 1 }), /4 MB/);
  assert.throws(() => a.validateAttachment({ name: 'a.png', mediaType: 'image/png', size: NaN }), /大小/);
});

test('draft limit is enforced across repeated picks, without losing accepted files', () => {
  const a = load();
  const item = (id, size = 1024) => ({ id, uri: `file:///${id}.png`, name: `${id}.png`, mediaType: 'image/png', size, dataUrl: 'data:image/png;base64,YQ==' });
  const first = a.mergeAttachments([], [item('a')]);
  assert.equal(a.mergeAttachments(first, [item('a'), item('b')]).length, 2);
  assert.throws(() => a.mergeAttachments([item('a'), item('b'), item('c')], [item('d'), item('e')]), /4 个/);
  assert.throws(() => a.mergeAttachments([item('a', a.MAX_ATTACHMENT_BYTES), item('b', a.MAX_ATTACHMENT_BYTES)], [item('c')]), /8 MB/);
  assert.equal(first.length, 1);
});

test('message files use data URLs and preserve the actual media type and name', () => {
  const a = load();
  const files = a.toFileParts([{ id: 'a', uri: 'file:///cache/a.pdf', name: 'notes.pdf', mediaType: 'application/pdf', size: 4, dataUrl: 'data:application/pdf;base64,JVBERg==' }]);
  assert.equal(files[0].url, 'data:application/pdf;base64,JVBERg==');
  assert.equal(files[0].filename, 'notes.pdf');
  assert.equal(files[0].mediaType, 'application/pdf');
  assert.equal(files[0].type, 'file');
  assert.throws(() => a.toFileParts([{ mediaType: 'image/png', dataUrl: 'https://example.com/private.png' }]), /附件数据/);
});
