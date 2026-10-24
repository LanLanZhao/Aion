/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Use LegendList's installed scrollToEnd implementation, including its footer
// offset and options merge order. A spy alone misses these native-list semantics.
const legendSource = ts.createSourceFile('legend.js', fs.readFileSync(require.resolve('@legendapp/list'), 'utf8'), ts.ScriptTarget.Latest);
let scrollToEndSource;
function findScrollToEnd(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(legendSource) === 'scrollToEnd') {
    scrollToEndSource = node.initializer.getText(legendSource);
  }
  ts.forEachChild(node, findScrollToEnd);
}
findScrollToEnd(legendSource);
assert.ok(scrollToEndSource, 'installed LegendList must provide scrollToEnd');

function resolveLegendEnd(options, footerSize) {
  let params;
  const scrollToEnd = vm.runInNewContext(`(${scrollToEndSource})`, {
    refState: { current: { props: { data: [{ id: 'last' }], stylePaddingBottom: 8 } } },
    ctx: {}, state: {},
    peek$: () => footerSize,
    scrollToIndex: (_ctx, _state, value) => { params = value; },
  });
  scrollToEnd(options);
  return params;
}

// Run the real component's layout worklets and callbacks without a native UI.
// This checks scroll geometry; gesture smoothness still requires a device.
function loadConversation(platform = 'android') {
  let keyboard;
  const animated = {
    View: 'Animated.View',
    createAnimatedComponent: (component) => component,
    useSharedValue: (value) => ({ value }),
    useDerivedValue: (callback) => ({ get value() { return callback(); } }),
    useAnimatedStyle: (callback) => callback,
    useAnimatedProps: (callback) => callback,
    withTiming: (value) => value,
    runOnJS: (callback) => callback,
  };
  const modules = {
    react: {
      createContext: () => 'Context',
      use: () => ({ messages: [] }),
      useCallback: (callback) => callback,
      useEffect: (callback) => callback(),
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}],
    },
    'react-native': { View: 'View', Text: 'Text' },
    'react-native-reanimated': { __esModule: true, default: animated, ...animated },
    'react-native-keyboard-controller': {
      useKeyboardHandler: (handler) => { keyboard = handler; },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    'expo-glass-effect': { isLiquidGlassAvailable: () => false },
    '@legendapp/list': { LegendList: 'LegendList' },
    '@legendapp/list/reanimated': { AnimatedLegendList: 'AnimatedLegendList' },
    '@/components/symbol-image': { SymbolImage: 'SymbolImage' },
    '../touchable-glass': { TouchableGlass: 'TouchableGlass' },
    '../tw': { KeyboardGestureArea: 'KeyboardGestureArea' },
    './chat-context': { useChatContext: () => ({ messages: [] }) },
  };
  const filename = path.resolve(__dirname, '../src/components/chat/conversation.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const sandbox = {
    exports: {},
    require: (name) => modules[name] ?? require(name),
    process: { env: { EXPO_OS: platform } },
    requestAnimationFrame: (callback) => callback(),
  };
  vm.runInNewContext(outputText, sandbox, { filename });
  const tree = sandbox.exports.Conversation({ renderMessage: () => null });
  const context = tree.props.value;
  const list = tree.props.children.props.children[0].props.children;
  const calls = [];
  list.props.ref.current = { scrollToEnd: (options) => calls.push(options) };
  list.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  const footerHeight = () => list.props.ListFooterComponent.props.style().height;
  return { keyboard, list, context, calls, footerHeight };
}

test('Android reserves scrollable space for a long conversation above the composer and keyboard', () => {
  const app = loadConversation();
  app.list.props.onContentSizeChange(400, 1000);
  assert.equal(app.footerHeight(), 92, 'closed keyboard: 68px composer + 24px safe area');
  app.keyboard.onMove({ height: 320 });
  assert.equal(app.context.promptInputStyle().bottom, 320);
  assert.equal(app.footerHeight(), 388, 'open keyboard: last message must clear composer + keyboard');
  app.keyboard.onInteractive({ height: 150 });
  assert.equal(app.footerHeight(), 218, 'interactive dismissal updates the real Android spacer');
  app.keyboard.onEnd({ height: 0 });
  assert.equal(app.footerHeight(), 92);
});

test('Android scroll-to-bottom targets the actual padded end and hides the scroll button there', () => {
  const app = loadConversation();
  app.list.props.onContentSizeChange(400, 1000);
  const footer = app.footerHeight();
  app.list.props.onContentSizeChange(400, 1000 + footer);
  app.context.scrollToBottom();
  const nativeEnd = resolveLegendEnd(app.calls.at(-1), footer);
  // 1000px of content includes 8px of bottom padding after the last item.
  const actualEndY = 992 - 600 - nativeEnd.viewOffset;
  assert.equal(actualEndY, 1000 + footer - 600, 'LegendList must include footer and bottom padding in its target');
  app.list.props.onScroll({ nativeEvent: { contentOffset: { y: actualEndY } } });
  assert.equal(app.context.scrollButtonStyle().opacity, 0, 'no double-counting Android bottom padding');
  app.list.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
  assert.equal(app.context.scrollButtonStyle().opacity, 1);
});

test('Android empty conversation keeps a nonnegative spacer with a multiline composer', () => {
  const app = loadConversation();
  app.context.onPromptInputLayout({ nativeEvent: { layout: { height: 128 } } });
  app.keyboard.onMove({ height: 320 });
  app.list.props.onContentSizeChange(400, 0);
  assert.ok(app.footerHeight() >= 448, 'empty content reserves room for multiline composer + keyboard');
});

test('iOS keeps its existing contentInset and scroll offset behavior', () => {
  const app = loadConversation('ios');
  app.list.props.onContentSizeChange(400, 1000);
  assert.equal(app.footerHeight(), 0);
  app.keyboard.onMove({ height: 320 });
  assert.equal(app.list.props.animatedProps().contentInset.bottom, 388);
  app.context.scrollToBottom();
  assert.equal(app.calls.at(-1).viewOffset, -388);
});
