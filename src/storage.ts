import { NativeModules, Platform } from 'react-native';

type Store = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

// The unpackaged Win32 app has no UWP ApplicationData-backed AsyncStorage, so it
// persists through the LNPackerModule file store instead.
const nativeStore = Platform.OS === 'windows' ? ((NativeModules.LNPackerModule as never) ?? null) : null;

let asyncStore: Store | null = null;
if (!nativeStore) {
  try {
    const module = require('@react-native-async-storage/async-storage');
    asyncStore = (module.default ?? module) as Store;
  } catch {
    asyncStore = null;
  }
}

const store: Store = nativeStore ?? asyncStore ?? { getItem: async () => null, setItem: async () => undefined };

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await store.getItem(`lnpacker.${key}`);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(key: string, value: T) {
  await store.setItem(`lnpacker.${key}`, JSON.stringify(value));
}
