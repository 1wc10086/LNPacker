/* eslint-disable no-bitwise -- the client signature protocol is defined in terms of bitwise operations. */
import { HttpClient } from '../core/http';
import { aesGcmDecrypt, decodeBase64, decodeUtf8, hmacSha1, md5Hex, sha256Bytes, sha256Hex } from '../core/crypto';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const baseUrl = 'https://novalpie.cc';
const apiUrl = `${baseUrl}/api`;
const bookUrl = /novalpie\.cc\/book\/(\d+)/;
const chapterUrl = /\/book\/\d+\/(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Server-side client key extracted from the reader bundle (B0ZzNCml.js).
const appKey = 'X9f2m8Q5zL1p4R7t0Y3u6W2s5V8x1B4n7M0k3J6h9G2d5F8c1A4b7E0r3T6y9U2i';
const customAlphabet = 'M9N8B7V6C5X4Z3L2K1J0HGFDSAPOIUYTREWQmnbvcxzlkjhgfdsaqwertyuiop+/';

type Session = { id: string; key: string; expires: number };
type ChapterData = { title: string; content: string; iv: string; tag: string; encrypted: boolean };
type ApiResponse = { success?: boolean; message?: string };
type NovelDetail = ApiResponse & { title: string; authorName: string; photoUrl?: string; spans?: string; platform?: string; tags?: string[]; description?: string };
type ChaptersResponse = ApiResponse & { data: { id: number; title: string }[] };
type ChapterResponse = ApiResponse & ChapterData;
type SessionResponse = ApiResponse & { session_id: string; session_key: string; expires: number };

export class NovelPieSource implements NovelSource {
  readonly name = 'NovelPie';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: '*/*' });
  private session?: Session;

  supports(url: string) { return bookUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = bookUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const data = await this.json<NovelDetail>(`/novels/${id}/detail`);
    const status = data.spans?.includes('完结') ? '已完结' : '连载中';
    return { id, url: `${baseUrl}/book/${id}`, title: data.title, author: data.authorName, status, coverUrl: data.photoUrl ?? undefined, tags: data.tags ?? [], publisher: data.platform ?? undefined, description: data.description ?? undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const data = await this.json<ChaptersResponse>(`/novels/${novel.id}/chapters`);
    const chapters: Chapter[] = (data.data ?? []).map(item => ({ title: item.title, url: `${baseUrl}/book/${novel.id}/${item.id}` }));
    if (!chapters.length) throw new Error('目录获取为空');
    return { novel, volumes: [{ title: '', chapters }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const id = chapterUrl.exec(chapter.url)?.[1];
    if (!id) throw new Error(`无法定位章节: ${chapter.title}`);
    const session = await this.ensureSession();
    const data = await this.json<ChapterResponse>(`/chapters/${id}/content`, { session: session.id, show_images: '1' });
    const body = data.encrypted ? this.decrypt(session.key, data) : data.content;
    return { title: data.title || chapter.title, body };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private async json<T>(path: string, query?: Record<string, string>, headers?: Record<string, string>): Promise<T> {
    const params = query ? `?${new URLSearchParams(query)}` : '';
    const data = JSON.parse(await this.client.text(`${apiUrl}${path}${params}`, headers)) as T & ApiResponse;
    if (data.success === false) throw new Error(data.message ?? '请求失败');
    return data;
  }

  private async ensureSession(): Promise<Session> {
    if (this.session && this.session.expires > Date.now() + 60_000) return this.session;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.random().toString().slice(2, 10);
    const data = await this.json<SessionResponse>('/reader/session-key', undefined, {
      'User-Agent': userAgent,
      Accept: '*/*',
      'X-Client-Signature': sign(timestamp, nonce, userAgent),
      'X-Client-Timestamp': String(timestamp),
      'X-Client-Nonce': nonce,
    });
    this.session = { id: data.session_id, key: data.session_key, expires: data.expires * 1000 };
    return this.session;
  }

  private decrypt(key: string, data: ChapterData) {
    const plaintext = aesGcmDecrypt(sha256Bytes(decodeBase64(key)), decodeBase64(data.iv), decodeBase64(data.content), decodeBase64(data.tag));
    return decodeUtf8(plaintext);
  }
}

export function sign(timestamp: number, nonce: string, userAgentValue: string) {
  const seconds = String(timestamp);
  const digest = md5Hex(userAgentValue + seconds + nonce);
  const hashed = sha256Hex(digest + appKey + rotateLeft3(parseInt(seconds, 10)));
  const secret = md5Hex(appKey);
  return customBase64(hmacSha1(secret, hashed));
}

function rotateLeft3(value: number) { return (((value << 3) | (value >>> 29)) >>> 0).toString(16); }

function customBase64(bytes: Uint8Array) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const block = (first << 16) | (second << 8) | third;
    result += customAlphabet[(block >> 18) & 63] + customAlphabet[(block >> 12) & 63];
    result += index + 1 < bytes.length ? customAlphabet[(block >> 6) & 63] : '=';
    result += index + 2 < bytes.length ? customAlphabet[block & 63] : '=';
  }
  return result;
}
