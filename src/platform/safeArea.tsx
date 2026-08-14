import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type Insets = { top: number; bottom: number; left: number; right: number };
type ProviderProps = { children?: React.ReactNode };

let SafeAreaProvider: React.FC<ProviderProps>;
let useSafeAreaInsets: () => Insets;

// Windows has no native safe-area module and desktop windows have no notch or
// status bar, so feed zero insets through the context and skip the native
// provider. This also prevents react-native-paper from mounting the native one.
if (Platform.OS === 'windows') {
  const { SafeAreaInsetsContext } = require('react-native-safe-area-context');
  const zero: Insets = { top: 0, bottom: 0, left: 0, right: 0 };
  SafeAreaProvider = ({ children }: ProviderProps) => (
    <SafeAreaInsetsContext.Provider value={zero}>
      <View style={styles.fill}>{children}</View>
    </SafeAreaInsetsContext.Provider>
  );
  useSafeAreaInsets = () => zero;
} else {
  const module = require('react-native-safe-area-context');
  SafeAreaProvider = module.SafeAreaProvider;
  useSafeAreaInsets = module.useSafeAreaInsets;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export { SafeAreaProvider, useSafeAreaInsets };
