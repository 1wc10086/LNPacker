import { HttpClient } from '../core/http';
import { escapeXml } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const novelUrl = /pixiv\.net\/novel\/show\.php\?id=(\d+)/;
const seriesUrl = /pixiv\.net\/novel\/series\/(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
type ApiEnvelope<T> = { error: boolean; message?: string; body: T };
type NovelInfo = { title: string; userName: string; description?: string; coverUrl?: string; tags: { tags: { tag: string }[] }; content: string; textEmbeddedImages?: Record<string, { urls: { original: string } }>; seriesNavData?: { seriesId: number; title?: string } };
type SeriesInfo = { title: string; userName: string; caption?: string; tags?: string[]; cover?: { urls: { original?: string } } };
type SeriesContent = { page: { seriesContents: { id: string }[] } };

export class PixivSource implements NovelSource {
  readonly name = 'Pixiv';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'application/json', Referer: 'https://www.pixiv.net/' }, 3000, 5000);

  supports(url: string) { return novelUrl.test(url) || seriesUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    if (seriesUrl.test(url)) {
      const id = seriesUrl.exec(url)?.[1] as string;
      const data = await this.json<ApiEnvelope<SeriesInfo>>(`https://www.pixiv.net/ajax/novel/series/${id}?lang=zh`);
      return { id: `s${id}`, url: `https://www.pixiv.net/novel/series/${id}`, title: data.body.title, author: data.body.userName, status: '连载中', coverUrl: data.body.cover?.urls?.original, tags: data.body.tags ?? [], description: this.stripHtml(data.body.caption) || undefined };
    }
    const id = novelUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const data = await this.json<ApiEnvelope<NovelInfo>>(`https://www.pixiv.net/ajax/novel/${id}?lang=zh`);
    return { id: `n${id}`, url: `https://www.pixiv.net/novel/show.php?id=${id}`, title: data.body.title, author: data.body.userName, status: '连载中', coverUrl: data.body.coverUrl, tags: (data.body.tags.tags ?? []).map(tag => tag.tag), description: this.stripHtml(data.body.description) || undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    if (novel.id.startsWith('s')) {
      const seriesId = novel.id.slice(1);
      const chapters: Chapter[] = [];
      let lastOrder = 0;
      while (true) {
        const data = await this.json<ApiEnvelope<SeriesContent>>(`https://www.pixiv.net/ajax/novel/series_content/${seriesId}?limit=30&last_order=${lastOrder}&order_by=asc&lang=zh`);
        const contents = data.body.page?.seriesContents ?? [];
        if (!contents.length) break;
        for (const item of contents) chapters.push({ title: `第 ${chapters.length + 1} 话`, url: `https://www.pixiv.net/novel/show.php?id=${item.id}` });
        if (contents.length < 30) break;
        lastOrder += contents.length;
      }
      if (!chapters.length) throw new Error('目录获取为空');
      return { novel, volumes: [{ title: novel.title, chapters }] };
    }
    return { novel, volumes: [{ title: novel.title, chapters: [{ title: novel.title, url: novel.url }] }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const id = /show\.php\?id=(\d+)/.exec(chapter.url)?.[1];
    if (!id) throw new Error(`无法定位章节: ${chapter.title}`);
    const data = await this.json<ApiEnvelope<NovelInfo>>(`https://www.pixiv.net/ajax/novel/${id}?lang=zh`);
    return { title: data.body.title || chapter.title, body: novelBodyToHtml(data.body.content, data.body.textEmbeddedImages) };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private async json<T>(url: string): Promise<T> {
    const data = JSON.parse(await this.client.text(url)) as ApiEnvelope<unknown> & T;
    if (data.error) throw new Error(data.message ?? 'Pixiv 请求失败');
    return data;
  }

  private stripHtml(value?: string) { return value ? value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : ''; }
}

export function novelBodyToHtml(content: string, images?: Record<string, { urls: { original: string } }>) {
  const placeholders = new Map<string, string>();
  let body = (content ?? '').replace(/\[newpage\]/g, '\n');
  if (images) for (const [imageId, info] of Object.entries(images)) {
    const token = `@@PIXIVIMG${imageId}@@`;
    body = body.replaceAll(`[uploadedimage:${imageId}]`, token);
    placeholders.set(token, info.urls.original);
  }
  return body.split(/\r?\n+/).map(line => line.trim()).filter(Boolean)
    .map(line => { const escaped = escapeXml(line); return `<p>${escaped.replace(/@@PIXIVIMG\d+@@/g, match => `<img src="${placeholders.get(match) ?? ''}" />`)}</p>`; })
    .join('');
}
