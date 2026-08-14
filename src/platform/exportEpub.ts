function load<T>(loader: () => T): T | null {
  try {
    return loader();
  } catch {
    return null;
  }
}

const FileSystem = load(() => require('expo-file-system/legacy'));
const Sharing = load(() => require('expo-sharing'));

const toBase64 = (data: Uint8Array) => {
  let result = '';
  data.forEach(byte => {
    result += String.fromCharCode(byte);
  });
  return btoa(result);
};

export async function saveEpub(name: string, bytes: Uint8Array) {
  if (!FileSystem) throw new Error('当前平台暂不支持导出文件');
  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('当前平台没有文件导出目录');
  const uri = `${directory}${name}`;
  await FileSystem.writeAsStringAsync(uri, toBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  if (Sharing && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: 'application/epub+zip', dialogTitle: name });
  }
  return uri;
}

export async function readCrashLog(): Promise<string> {
  if (!FileSystem?.documentDirectory) return '';
  try {
    return await FileSystem.readAsStringAsync(`${FileSystem.documentDirectory}crash.log`);
  } catch {
    return '';
  }
}
