/* eslint-disable no-bitwise -- crypto primitives are defined in terms of bitwise operations. */
import { md5 } from '@noble/hashes/legacy';
import { sha1 } from '@noble/hashes/sha1';
import { sha256 } from '@noble/hashes/sha2';
import { hmac } from '@noble/hashes/hmac';
import { gcm } from '@noble/ciphers/aes';

export const encodeUtf8 = (value: string): Uint8Array => {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
};

export const decodeUtf8 = (bytes: Uint8Array): string => {
  let result = '';
  for (let index = 0; index < bytes.length;) {
    const byte = bytes[index];
    if (byte < 0x80) { result += String.fromCharCode(byte); index += 1; }
    else if (byte < 0xe0) { result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[index + 1] & 0x3f)); index += 2; }
    else if (byte < 0xf0) { result += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[index + 1] & 0x3f) << 6) | (bytes[index + 2] & 0x3f)); index += 3; }
    else { result += String.fromCodePoint(((byte & 0x07) << 18) | ((bytes[index + 1] & 0x3f) << 12) | ((bytes[index + 2] & 0x3f) << 6) | (bytes[index + 3] & 0x3f)); index += 4; }
  }
  return result;
};

/* eslint-disable no-bitwise -- Base64 is decoded as a six-bit binary stream. */
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const decodeBase64 = (value: string): Uint8Array => {
  const input = value.replace(/\s/g, '').replace(new RegExp('=+$'), '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of input) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('无效的 Base64 数据');
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 0xff); }
  }
  return Uint8Array.from(bytes);
};

const toHex = (bytes: Uint8Array) => Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');

export const md5Hex = (value: string) => toHex(md5(encodeUtf8(value)));
export const sha256Hex = (value: string) => toHex(sha256(encodeUtf8(value)));
export const sha256Bytes = (bytes: Uint8Array) => sha256(bytes);
export const hmacSha1 = (key: string, message: string) => hmac(sha1, encodeUtf8(key), encodeUtf8(message));

export const aesGcmDecrypt = (key: Uint8Array, iv: Uint8Array, data: Uint8Array, tag: Uint8Array): Uint8Array => {
  const payload = new Uint8Array(data.length + tag.length);
  payload.set(data);
  payload.set(tag, data.length);
  return gcm(key, iv).decrypt(payload);
};
