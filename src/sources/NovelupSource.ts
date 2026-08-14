import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, document, html, one, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const novelupUrl = /novelup\.plus\/story\/(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class NovelupSource implements NovelSource {
  readonly name = 'ノベ友';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html', 'Accept-Language': 'ja-JP,ja;q=0.9' }, 3000, 5000);

  supports(url: string) { return novelupUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = novelupUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const root = document(await this.client.text(`https://novelup.plus/story/${id}`));
    const title = text(one('h1', root)) || text(one('.story_title', root)) || '不明';
    const author = text(one('.story_author a, .author a, .novel_author a', root)) || '不明';
    return { id, url: `https://novelup.plus/story/${id}`, title, author, status: '連載中', tags: [], description: text(one('.story_intro, #story_intro, .novel_intro', root)) || undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const chapters: Chapter[] = [];
    const seen = new Set<string>();
    const base = novel.url;
    let page = 1;
    while (true) {
      const root = document(await this.client.text(`${base}${page > 1 ? `?p=${page}` : ''}`));
      const links = all('a[href]', root)
        .map(link => ({ title: text(link), href: attr(link, 'href') ?? '' }))
        .filter(link => link.href.includes(`/story/${novel.id}/`) && !link.href.includes('/comment') && link.title.trim() && !seen.has(link.href));
      if (!links.length) break;
      for (const link of links) { seen.add(link.href); chapters.push({ title: link.title, url: absoluteUrl(base, link.href) }); }
      const countMatch = text(one('body', root)).match(/総エピソード数\s*[:：]?\s*([\d,]+)/);
      const total = countMatch ? Number(countMatch[1].replace(/,/g, '')) : 0;
      if (!total || chapters.length >= total) break;
      page += 1;
      if (page > 50) break;
    }
    if (!chapters.length) throw new Error('目录获取为空');
    return { novel, volumes: [{ title: novel.title, chapters }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.client.text(chapter.url));
    const content = one('#episode_content', root) ?? one('.episode_content', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    return { title: text(one('.episode_title, h1', root)) || chapter.title, body: html(content.children) };
  }

  async getImage(url: string) { return this.client.bytes(url); }
}
