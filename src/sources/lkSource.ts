import { inflate } from 'pako';
import { decodeBase64, decodeUtf8 } from '../core/crypto';
import { HttpClient } from '../core/http';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const lkUrl = /lightnovel\.(?:us|fun)\/(?:cn\/)?(?:(?:detail|article|series|page)\/)?(\d+)/;
const userAgent = 'Dart/2.10 (dart:io)';
const baseParam = { platform: 'android', client: 'app', sign: '', ver_name: '0.11.52', ver_code: '192', gz: 1 };

type LkArticle = { aid: number; title: string; time: string };
type LkResponse = { code: number; msg?: string; data: Record<string, unknown> };
export type LkDetail = { aid: number; title: string; cover: string; summary: string; content: string; res?: { res_info?: Record<string, { url: string }> }; attaches?: { res_info?: Record<string, { url: string; isimage?: number }> } };
type LkSeries = { sid: number; name: string; author: string; cover: string; intro: string; articles: LkArticle[] };

export class LkSource implements NovelSource {
  readonly name = '轻之国度';
  private readonly client = new HttpClient({ 'Content-Type': 'application/json; charset=UTF-8', 'User-Agent': userAgent, Accept: '*/*' }, 3000, 3000);

  supports(url: string) { return lkUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = Number(lkUrl.exec(url)?.[1]);
    if (!id) throw new Error('不支持的小说地址');
    const api = this.apiHost(url);
    const detail = await this.request<LkDetail>(api, '/api/article/get-detail', { aid: id, simple: 0 });
    return {
      id: String(id), url: `https://www.lightnovel.us/detail/${id}`, title: detail.title,
      author: '未知作者', status: '连载中', coverUrl: detail.cover || undefined,
      tags: [], description: detail.summary || undefined,
    };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const api = this.apiHost(novel.url);
    const series = await this.request<LkSeries>(api, '/api/series/get-info', { sid: Number(novel.id) });
    const chapters: Chapter[] = (series.articles ?? []).map(article => ({ title: article.title, url: `https://www.lightnovel.us/detail/${article.aid}` }));
    if (!chapters.length) throw new Error('目录获取为空');
    return {
      novel: { ...novel, title: series.name || novel.title, author: series.author || novel.author, coverUrl: series.cover || novel.coverUrl, description: series.intro || novel.description },
      volumes: [{ title: series.name || novel.title, chapters }],
    };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const id = Number(/detail\/(\d+)/.exec(chapter.url)?.[1]);
    if (!id) throw new Error(`无法定位章节: ${chapter.title}`);
    const detail = await this.request<LkDetail>(this.apiHost(chapter.url), '/api/article/get-detail', { aid: id, simple: 0 });
    return { title: detail.title || chapter.title, body: lkContentToHtml(detail) };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private async request<T>(api: string, path: string, data: Record<string, unknown>): Promise<T> {
    const text = await this.client.post(`${api}${path}`, JSON.stringify({ ...baseParam, d: data }));
    const response = JSON.parse(decodeUtf8(inflate(decodeBase64(text)))) as LkResponse;
    if (response.code !== 0) throw new Error(response.msg ?? '轻之国度请求失败');
    return response.data as T;
  }

  private apiHost(url: string) {
    const host = new URL(url).host.replace(/^www\./, '').replace(/^api\./, '');
    return `https://api.${host}`;
  }
}

export function lkContentToHtml(detail: Pick<LkDetail, 'content' | 'res' | 'attaches'>): string {
  const images = new Map<string, string>();
  for (const group of [detail.res?.res_info, detail.attaches?.res_info]) {
    for (const [key, value] of Object.entries(group ?? {})) if (value?.url) images.set(key, value.url);
  }
  const replaceImage = (_: string, key: string) => { const url = images.get(key); return url ? `<img src="${url}" />` : ''; };
  let result = detail.content ?? '';
  result = result.replace(/\[img\]((?:https?:)?\/\/[^\]]+)\[\/img\]/g, (_, url: string) => `<img src="${url}" />`);
  result = result.replace(/\[res\](\d+)\[\/res\]/g, replaceImage);
  result = result.replace(/\[attach\](\d+)\[\/attach\]/g, replaceImage);
  result = result.replace(/\r?\n/g, '<br />').replace(/\[.*?\]/g, '');
  return result;
}
