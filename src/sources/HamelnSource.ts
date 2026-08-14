import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, document, html, one, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const hamelnUrl = /syosetu\.org\/novel\/(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class HamelnSource implements NovelSource {
  readonly name = 'ハーメルン';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html', 'Accept-Language': 'ja-JP,ja;q=0.9' }, 6000, 6000);

  supports(url: string) { return hamelnUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = hamelnUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const root = document(await this.client.text(`https://syosetu.org/novel/${id}/`));
    if (text(one('title', root)).includes('Just a moment')) throw new Error('ハーメルン 触发了 Cloudflare 验证，请稍后重试');
    return {
      id, url: `https://syosetu.org/novel/${id}/`, title: text(one('[itemprop="name"]', root)) || '不明',
      author: text(one('[itemprop="author"] a', root)) || '不明', status: '連載中', tags: [],
      description: text(one('#maind', root)) || undefined,
    };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const root = document(await this.client.text(`https://syosetu.org/novel/${novel.id}/`));
    const chapters: Chapter[] = all('a[href]', root)
      .filter(link => /\/novel\/\d+\/\d+\.html/.test(attr(link, 'href') ?? ''))
      .map(link => ({ title: text(link), url: absoluteUrl(novel.url, attr(link, 'href') as string) }));
    if (!chapters.length) throw new Error('目录获取为空');
    return { novel, volumes: [{ title: novel.title, chapters }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.client.text(chapter.url));
    const content = one('#honbun', root);
    const afterword = one('#atogaki', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    const body = html(content.children) + (afterword ? html(afterword.children) : '');
    return { title: chapter.title, body };
  }

  async getImage(url: string) { return this.client.bytes(url); }
}
