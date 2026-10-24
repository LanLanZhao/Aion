/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadDrawer(open) {
  let backHandler;
  let closed = 0;
  let activeInteractions = 0;
  const cleanups = [];
  const handlers = {};
  const gesture = new Proxy({}, {
    get: (_target, name) => (value) => { handlers[name] = value; return gesture; },
  });
  const animated = {
    View: 'Animated.View',
    useSharedValue: (value) => ({ value }),
    useDerivedValue: (callback) => ({ get value() { return callback(); } }),
    useAnimatedProps: (callback) => callback,
    useAnimatedStyle: (callback) => callback,
    withSpring: (value) => value,
    runOnJS: (callback) => callback,
    ReduceMotion: { Never: 'never' },
  };
  const modules = {
    react: {
      useRef: (value) => ({ current: value }),
      useEffect: (callback) => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
      useCallback: (callback) => callback,
      useMemo: (callback) => callback(),
    },
    'expo-haptics': { impactAsync: () => {}, ImpactFeedbackStyle: { Light: 'light' } },
    'react-native': {
      View: 'View', Pressable: 'Pressable',
      useWindowDimensions: () => ({ width: 400 }),
      Keyboard: { dismiss: () => {} },
      InteractionManager: {
        createInteractionHandle: () => { activeInteractions++; return 1; },
        clearInteractionHandle: () => { activeInteractions--; },
      },
      BackHandler: {
        addEventListener: (_event, callback) => {
          backHandler = callback;
          return { remove: () => { backHandler = undefined; } };
        },
      },
    },
    'react-native-gesture-handler': {
      Gesture: { Pan: () => gesture },
      GestureDetector: 'GestureDetector', GestureHandlerRootView: 'Root',
      State: { UNDETERMINED: 0 },
    },
    'react-native-reanimated': { __esModule: true, default: animated, ...animated },
    uniwind: { withUniwind: (component) => component },
  };
  const filename = path.resolve(__dirname, '../src/components/drawer-layout.tsx');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const sandbox = {
    exports: {},
    require: (name) => modules[name] ?? require(name),
    process: { env: { EXPO_OS: 'android' } },
  };
  vm.runInNewContext(outputText, sandbox, { filename });
  sandbox.exports.DrawerLayout({ open, onOpen: () => {}, onClose: () => { closed++; } });
  return {
    handlers,
    get backHandler() { return backHandler; },
    get closed() { return closed; },
    get activeInteractions() { return activeInteractions; },
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

test('Android Back closes an open drawer and removes its listener on unmount', () => {
  const drawer = loadDrawer(true);
  assert.equal(drawer.backHandler(), true);
  assert.ok(drawer.closed > 0);
  drawer.unmount();
  assert.equal(drawer.backHandler, undefined);
});

test('a closed drawer leaves Android Back to navigation', () => {
  assert.equal(loadDrawer(false).backHandler, undefined);
});

test('cancelled drawer gestures release their interaction handle', () => {
  const drawer = loadDrawer(false);
  drawer.handlers.onStart();
  assert.equal(drawer.activeInteractions, 1);
  drawer.handlers.onFinalize();
  assert.equal(drawer.activeInteractions, 0);
});

test('unmount during a drawer drag releases its interaction handle', () => {
  const drawer = loadDrawer(false);
  drawer.handlers.onStart();
  drawer.unmount();
  assert.equal(drawer.activeInteractions, 0);
});
