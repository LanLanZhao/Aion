// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', '.cache/**', 'android/**', 'ios/**'],
  },
  {
    // These components opt out of React Compiler. Their UI-thread worklets
    // mutate Reanimated shared values using its supported .value API.
    files: ['src/components/chat/conversation.tsx', 'src/components/drawer-layout.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    // Gesture callbacks invoke JS handlers after render; the compiler lint
    // cannot trace runOnJS and mistakes those handlers for render-time calls.
    files: ['src/components/drawer-layout.tsx'],
    rules: { 'react-hooks/refs': 'off' },
  },
]);
