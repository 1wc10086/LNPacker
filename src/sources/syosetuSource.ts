import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, cloneNodes, document, html, one, remove, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const syosetuUrl = /syosetu\.com\/([a-z0-9]+)\/?/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class SyosetuSource implements NovelSource {
  readonly name = '小説家になろう';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html', 'Accept-Language': 'ja-JP,ja;q=0.9' }, 3000, 5000);

  supports(url: string) { return syosetuUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const ncode = syosetuUrl.exec(url)?.[1];
    if (!ncode) throw new Error('不支持的小说地址');
    const base = this.base(ncode);
    const root = document(await this.client.text(`${base}/${ncode}/`, { Cookie: 'over18=yes' }));
    const author = text(one('.p-novel__author a', root)) || '不明';
    return { id: ncode, url: `${base}/${ncode}/`, title: text(one('.p-novel__title', root)), author, status: '連載中', tags: [], description: text(one('#novel_ex', root)) || undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const volumes: Volume[] = [];
    let volume: Volume | undefined;
    let page = 1;
    while (true) {
      const root = document(await this.client.text(`${novel.url}${page > 1 ? `?p=${page}` : ''}`, { Cookie: 'over18=yes' }));
      for (const node of all('.p-eplist__chapter-title, .p-eplist__sublist > a', root)) {
        if (node.attribs.class?.includes('p-eplist__chapter-title')) {
          if (volume) volumes.push(volume);
          volume = { title: text(node), chapters: [] };
        } else if (node.name === 'a') {
          if (!volume) volume = { title: '', chapters: [] };
          volume.chapters.push({ title: text(node), url: absoluteUrl(novel.url, attr(node, 'href') ?? '') });
        }
      }
      const next = one('.c-pager__item--next', root);
      if (!next || !attr(next, 'href') || !volume) break;
      page += 1;
    }
    if (volume) volumes.push(volume);
    if (!volumes.some(item => item.chapters.length)) throw new Error('目录获取为空');
    return { novel, volumes };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.client.text(chapter.url, { Cookie: 'over18=yes' }));
    const content = one('.js-novel-text', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    remove(all('script, style', content));
    return { title: chapter.title, body: html(cloneNodes(content.children)) };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private base(ncode: string) { return ncode.startsWith('n18') ? 'https://novel18.syosetu.com' : 'https://ncode.syosetu.com'; }
}
