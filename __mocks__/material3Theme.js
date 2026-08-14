const { MD3DarkTheme, MD3LightTheme } = require('react-native-paper');

module.exports = {
  isDynamicThemeSupported: false,
  useMaterial3Theme: () => ({
    theme: { dark: MD3DarkTheme.colors, light: MD3LightTheme.colors },
    resetTheme: jest.fn(),
    updateTheme: jest.fn(),
  }),
};
