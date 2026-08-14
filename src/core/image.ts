/* eslint-disable no-bitwise -- image signatures and WebP headers are binary formats. */
export type ImageInfo = { width: number; height: number; mediaType: string };

export function imageInfo(data: Uint8Array): ImageInfo | undefined {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength); if (data.length < 12) return undefined;
  if (String.fromCharCode(...data.slice(0, 3)) === 'GIF') return { width: view.getUint16(6, true), height: view.getUint16(8, true), mediaType: 'image/gif' };
  if (data[0] === 0x89 && String.fromCharCode(...data.slice(1, 4)) === 'PNG') return { width: view.getUint32(16), height: view.getUint32(20), mediaType: 'image/png' };
  if (data[0] === 0x42 && data[1] === 0x4d) return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)), mediaType: 'image/bmp' };
  if (data[0] === 0xff && data[1] === 0xd8) { for (let offset = 2; offset + 9 < data.length;) { if (data[offset] !== 0xff) break; const marker = data[offset + 1]; const length = view.getUint16(offset + 2); if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5), mediaType: 'image/jpeg' }; offset += 2 + length; } }
  if (String.fromCharCode(...data.slice(0, 4)) === 'RIFF' && String.fromCharCode(...data.slice(8, 12)) === 'WEBP') {
    const type = String.fromCharCode(...data.slice(12, 16));
    if (type === 'VP8X') return { width: 1 + view.getUint8(24) + view.getUint8(25) * 256 + view.getUint8(26) * 65536, height: 1 + view.getUint8(27) + view.getUint8(28) * 256 + view.getUint8(29) * 65536, mediaType: 'image/webp' };
    if (type === 'VP8 ' && data.length >= 30) return { width: 1 + (view.getUint16(26, true) & 0x3fff), height: 1 + (view.getUint16(28, true) & 0x3fff), mediaType: 'image/webp' };
    if (type === 'VP8L' && data.length >= 25) { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, mediaType: 'image/webp' }; }
  }
  return undefined;
}
