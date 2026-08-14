module.exports = {
  dependencies: {
    // react-native-share's Windows native code targets UWP and is not used by
    // this app (iOS-only share); exclude it from react-native-windows autolinking.
    'react-native-share': {
      platforms: {
        windows: null,
      },
    },
    // @react-native-async-storage/async-storage's Windows implementation relies on
    // the UWP ApplicationData API (requires a packaged app identity) and cannot run
    // in this unpackaged Win32 app. Storage on Windows is handled by LNPackerModule.
    '@react-native-async-storage/async-storage': {
      platforms: {
        windows: null,
      },
    },
  },
};
