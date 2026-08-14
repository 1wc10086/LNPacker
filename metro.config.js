const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable every native platform this project can target.
config.resolver.platforms = [...config.resolver.platforms, 'macos', 'windows'];

// react-native-windows: keep the native build folder and its build staging out of Metro.
const rnwPath = path.dirname(require.resolve('react-native-windows/package.json'));
config.resolver.blockList = [
  ...config.resolver.blockList,
  new RegExp(`${path.resolve(__dirname, 'windows').replace(/[/\\]/g, '/')}.*`),
  new RegExp(`${rnwPath.replace(/[/\\]/g, '/')}/build/.*`),
  new RegExp(`${rnwPath.replace(/[/\\]/g, '/')}/target/.*`),
  /.*\.ProjectImports\.zip/,
];

// react-native-macos: resolve `react-native` imports to the macOS fork.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'macos' && (moduleName === 'react-native' || moduleName.startsWith('react-native/'))) {
    return context.resolveRequest(context, moduleName.replace('react-native', 'react-native-macos'), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const originalGetModulesRunBeforeMainModule = config.serializer.getModulesRunBeforeMainModule;
config.serializer.getModulesRunBeforeMainModule = () => {
  try {
    return [
      require.resolve('react-native/Libraries/Core/InitializeCore'),
      require.resolve('react-native-macos/Libraries/Core/InitializeCore'),
    ];
  } catch {}
  return originalGetModulesRunBeforeMainModule();
};

module.exports = config;
