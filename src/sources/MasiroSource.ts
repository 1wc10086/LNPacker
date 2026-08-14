import { HttpClient } from '../core/http';
import { all, attr, document, html, one, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const masiroUrl = /masiro\.me\/(?:admin\/)?(?:novelView|novel\/[^/]+)\?novel_id=(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
type ChapterJson = { id: number; title: string; parent_id: number };
type VolumeJson = { id: number; title: string };

export class MasiroSource implements NovelSource {
  readonly name = '真白萌';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html', Referer: 'https://masiro.me/admin' }, 6000, 6000);

  supports(url: string) { return masiroUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = masiroUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const page = await this.client.text(`https://masiro.me/admin/novelView?novel_id=${id}`);
    if (!page.includes('novel-title')) throw new Error('真白萌需要登录才能访问，请在浏览器中先登录');
    const root = document(page);
    const cover = one('.img-thumbnail', root) ?? one('img.cover', root);
    const tags = all('.tags a', root).map(item => text(item));
    return {
      id, url: `https://masiro.me/admin/novelView?novel_id=${id}`, title: text(one('.novel-title', root)),
      author: text(one('.author a', root)) || '未知作者', status: '连载中',
      coverUrl: attr(cover, 'data-src') ?? attr(cover, 'src') ?? undefined,
      tags, description: text(one('.brief', root)) || undefined,
    };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const page = await this.client.text(`https://masiro.me/admin/novelView?novel_id=${novel.id}`);
    const volumesJson = this.readJson<VolumeJson[]>(page, 'f-chapters-json');
    const chaptersJson = this.readJson<ChapterJson[]>(page, 'chapters-json');
    if (!volumesJson?.length || !chaptersJson?.length) throw new Error('目录获取为空');
    const volumes: Volume[] = volumesJson.map(parent => ({
      title: parent.title,
      chapters: chaptersJson.filter(chapter => chapter.parent_id === parent.id).map(chapter => ({ title: chapter.title, url: `https://masiro.me/admin/novelReading?cid=${chapter.id}` })),
    }));
    return { novel, volumes };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const page = await this.client.text(chapter.url);
    const root = document(page);
    const content = one('.nvl-content', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.title}`);
    return { title: chapter.title, body: html(content.children) };
  }

  async getImage(url: string) { return this.client.bytes(url, { Referer: 'https://masiro.me/' }); }

  private readJson<T>(page: string, id: string): T | undefined {
    const script = one(`#${id}`, document(page));
    const raw = script ? text(script) : '';
    if (!raw) return undefined;
    try { return JSON.parse(raw) as T; } catch { return undefined; }
  }
}
