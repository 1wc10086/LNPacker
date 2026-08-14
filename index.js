/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import config from './app.json';

const appName = config.expo.name;

if (global.ErrorUtils) {
  const previousHandler = global.ErrorUtils.getGlobalHandler
    ? global.ErrorUtils.getGlobalHandler()
    : undefined;
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const FileSystem = require('expo-file-system/legacy');
      const line = `\n===== ${new Date().toISOString()} [JS ${isFatal ? 'FATAL' : 'ERROR'}] =====\n${
        error && (error.stack || error.message || String(error))
      }\n`;
      if (FileSystem && FileSystem.documentDirectory) {
        FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}crash.log`, line, {
          encoding: FileSystem.EncodingType.UTF8,
        }).catch(() => undefined);
      }
    } catch {}
    if (previousHandler) previousHandler(error, isFatal);
  });
}

AppRegistry.registerComponent(appName, () => App);
