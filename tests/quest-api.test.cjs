/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const { test } = require('node:test');

function load(relative, options = {}) {
  const filename = path.resolve(__dirname, '../', relative);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const sandbox = { exports: {}, Request, Response, TextDecoder, URL, atob, __DEV__: options.development ?? true, process: { env: options.env ?? {} },
    require(name) {
      if (name === '@ai-sdk/anthropic') return { anthropic: model => { options.called?.(model); return model; } };
      if (name === 'ai') return { convertToModelMessages: async messages => messages, streamText: () => ({ toUIMessageStreamResponse: () => new Response('stream') }) };
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, options);
      return require(name);
    },
  };
  vm.runInNewContext(outputText, sandbox, { filename });
  return sandbox.exports;
}

const message = parts => ({ id: 'user-1', role: 'user', parts });
test('actual AI SDK first-turn output can be submitted as second-turn history', async () => {
  const { Chat } = require('@ai-sdk/react');
  const chat = new Chat({ id: 'sdk-multi-turn', transport: {
    async sendMessages() {
      return new ReadableStream({ start(controller) {
        for (const chunk of [
          { type: 'start', messageId: 'assistant-1' }, { type: 'start-step' },
          { type: 'reasoning-start', id: 'r' }, { type: 'reasoning-delta', id: 'r', delta: 'reasoning' }, { type: 'reasoning-end', id: 'r' },
          { type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'first reply' }, { type: 'text-end', id: 't' },
          { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' },
        ]) controller.enqueue(chunk);
        controller.close();
      } });
    },
  } });
  await chat.sendMessage({ text: 'first question' });
  assert.ok(chat.messages[1].parts.some(part => part.type === 'step-start'));
  const { parseChatRequest } = load('src/server/chat-request.ts');
  const result = await parseChatRequest(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [...chat.messages, { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'next question' }] }] }) }));
  assert.equal(result.messages[1].parts[0].text, 'first reply');
});
test('API rejects remote attachment URLs and unapproved models before model invocation', async () => {
  const { parseChatRequest } = load('src/server/chat-request.ts');
  await assert.rejects(() => parseChatRequest(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [message([{ type: 'file', mediaType: 'image/png', url: 'http://169.254.169.254/private' }])] }) })), /附件/);
  await assert.rejects(() => parseChatRequest(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ model: 'arbitrary-expensive-model', messages: [message([{ type: 'text', text: 'hi' }])] }) })), /模型/);
});

test('API validates the requested response language and defaults to Chinese', async () => {
  const { parseChatRequest } = load('src/server/chat-request.ts');
  const request = language => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ language, messages: [message([{ type: 'text', text: 'hi' }])] }) });
  assert.equal((await parseChatRequest(request(undefined))).language, 'zh');
  assert.equal((await parseChatRequest(request('en'))).language, 'en');
  await assert.rejects(() => parseChatRequest(request('invalid')), /格式/);
});

test('API accepts bounded project instructions and rejects oversized project context', async () => {
  const { parseChatRequest } = load('src/server/chat-request.ts');
  const request = projectInstructions => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ projectInstructions, messages: [message([{ type: 'text', text: 'hi' }])] }) });
  assert.equal((await parseChatRequest(request('Use concise answers.'))).projectInstructions, 'Use concise answers.');
  await assert.rejects(() => parseChatRequest(request('x'.repeat(4001))), /格式/);
});

test('API decodes text files into user text and retains PDF image parts', async () => {
  const { parseChatRequest } = load('src/server/chat-request.ts');
  const result = await parseChatRequest(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ messages: [message([
    { type: 'file', mediaType: 'text/plain', filename: 'notes.txt', url: `data:text/plain;base64,${Buffer.from('hello notes').toString('base64')}` },
    { type: 'file', mediaType: 'application/pdf', filename: 'a.pdf', url: 'data:application/pdf;base64,JVBERg==' },
  ])] }) }));
  assert.match(result.messages[0].parts[0].text, /hello notes/);
  assert.match(result.messages[0].parts[0].text, /notes.txt/);
  assert.equal(result.messages[0].parts[1].type, 'file');
});

test('production API is closed until real authentication exists, even with a provider key', async () => {
  let calls = 0;
  const { POST } = load('src/app/api/chat+api.ts', { development: false, env: { ANTHROPIC_API_KEY: 'test-not-a-real-key' }, called: () => calls++ });
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});

test('native API resolver uses a reachable dev origin and requires HTTPS in production', () => {
  const { resolveChatApiUrl } = load('src/components/chat/api-url.ts');
  assert.equal(resolveChatApiUrl(undefined, '127.0.0.1:8081', true, 'android'), 'http://127.0.0.1:8081/api/chat');
  assert.equal(resolveChatApiUrl('https://example.com', undefined, false, 'android'), 'https://example.com/api/chat');
  assert.equal(resolveChatApiUrl('http://example.com/api/chat', undefined, false, 'android'), undefined);
  assert.equal(resolveChatApiUrl(undefined, undefined, false, 'android'), undefined);
});
