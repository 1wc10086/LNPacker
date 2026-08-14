import { NativeModules, Platform } from 'react-native';

export type ExportFile = { name: string; base64: string };

export type ExportResult = { cancelled: boolean; count: number };

export const safeName = (name: string) =>
  name.replace(/[:*?"\\/<>|\0　]/g, ' ').replace(/^\.|\.$/g, '').replace(/\s+/g, ' ').trim() || 'novel';

const native: { pickFolder?: () => Promise<string | null>; writeFiles?: (files: ExportFile[], directory: string) => Promise<number> } | null =
  Platform.OS === 'macos' || Platform.OS === 'windows'
    ? (NativeModules.LNPackerModule as never) ?? null
    : null;

export const hasFolderPicker = Platform.OS === 'windows' || Platform.OS === 'macos';

export async function pickFolder(): Promise<string | null> {
  if (!native?.pickFolder) return null;
  return (await native.pickFolder()) ?? null;
}

export async function writeFilesToFolder(files: ExportFile[], directory: string): Promise<number> {
  if (!native?.writeFiles) throw new Error('当前平台暂不支持写入文件夹');
  return await native.writeFiles(files, directory);
}

export async function exportAll(files: ExportFile[]): Promise<ExportResult> {
  switch (Platform.OS) {
    case 'android':
      return exportAndroid(files);
    case 'ios':
      return exportIos(files);
    case 'macos': {
      const directory = await pickFolder();
      if (!directory) return { cancelled: true, count: 0 };
      const count = await writeFilesToFolder(files, directory);
      return { cancelled: false, count };
    }
    default:
      throw new Error('请使用导出对话框');
  }
}

async function exportAndroid(files: ExportFile[]): Promise<ExportResult> {
  const { openDocumentTree, createFile, writeFile } = require('react-native-saf-x');
  const tree = await openDocumentTree(true);
  if (!tree) return { cancelled: true, count: 0 };
  let count = 0;
  for (const file of files) {
    const uri = `${tree.uri}/${encodeURIComponent(safeName(file.name))}`;
    await createFile(uri, { mimeType: 'application/epub+zip' });
    await writeFile(uri, file.base64, { encoding: 'base64' });
    count += 1;
  }
  return { cancelled: false, count };
}

async function exportIos(files: ExportFile[]): Promise<ExportResult> {
  const FileSystem = require('expo-file-system/legacy');
  const directory = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}lnpacker-export/` : '';
  if (!directory) throw new Error('无法创建临时目录');
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const urls: string[] = [];
  for (const file of files) {
    const uri = `${directory}${safeName(file.name)}`;
    await FileSystem.writeAsStringAsync(uri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
    urls.push(uri);
  }
  const Share = require('react-native-share').default;
  let cancelled = false;
  try {
    const result = await Share.open({ urls, failOnCancel: false });
    cancelled = result?.success === false;
  } catch {
    cancelled = true;
  }
  return { cancelled, count: cancelled ? 0 : files.length };
}
