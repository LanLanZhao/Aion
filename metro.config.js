const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Local Android tools, AVD data and package caches are not application sources.
// Exclude them from crawling and watching as well as module resolution.
const upstreamBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(upstreamBlockList)
    ? upstreamBlockList
    : upstreamBlockList ? [upstreamBlockList] : []),
  /(^|[\\/])\.cache([\\/]|$)/,
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    ["@expo/ui/swift-ui", "@expo/ui/swift-ui/modifiers"].includes(moduleName)
  ) {
    return {
      type: "empty",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  debug: true,
});
