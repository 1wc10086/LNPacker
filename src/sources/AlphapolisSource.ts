import { HttpClient } from '../core/http';
import { all, attr, document, html, one, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const alphaUrl = /alphapolis\.co\.jp\/novel\/(\d+)(?:\/(\d+))?/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class AlphapolisSource implements NovelSource {
  readonly name = 'アルファポリス';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html', 'Accept-Language': 'ja-JP,ja;q=0.9' }, 3000, 5000);

  supports(url: string) { return alphaUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const match = alphaUrl.exec(url);
    if (!match) throw new Error('不支持的小说地址');
    const id = match[1];
    const root = document(await this.fetch(url));
    const title = text(one('h1, h2.series-title, .series-title, .novel-title', root)) || '不明';
    const author = text(one('a[href*="/author/"], .author a', root)) || '不明';
    return { id, url: `https://www.alphapolis.co.jp/novel/${id}`, title, author, status: '連載中', tags: [], description: text(one('.series-introduction, #series_introduction', root)) || undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const root = document(await this.fetch(`https://www.alphapolis.co.jp/novel/${novel.id}`));
    const chapters: Chapter[] = all('div.episode a[href]', root)
      .map(link => ({ title: text(link), url: attr(link, 'href') ?? '' }))
      .filter(chapter => /alphapolis\.co\.jp\/novel\/\d+\/\d+/.test(chapter.url) && chapter.title.trim());
    if (!chapters.length) throw new Error('目录获取为空');
    return { novel, volumes: [{ title: novel.title, chapters }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.fetch(chapter.url));
    const content = one('#novelBody', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    return { title: text(one('.episode-title, h1', root)) || chapter.title, body: html(content.children) };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private async fetch(url: string) {
    const page = await this.client.text(url);
    if (page.includes('awsWaf') || page.includes('AwsWafIntegration')) throw new Error('アルファポリス 触发了 AWS WAF 验证，请在浏览器中完成验证后重试');
    return page;
  }
}
