import { absoluteUrl, HttpClient } from '../core/http';
import type { Element } from 'domhandler';
import { all, attr, document, html, one, remove, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const esjUrl = /esjzone\.(?:cc|one)\/(?:detail|forum)\/(\d+)/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class EsjZoneSource implements NovelSource {
  readonly name = 'ESJZone';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html' }, 3000, 5000);

  supports(url: string) { return esjUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = esjUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const detailUrl = `https://www.esjzone.cc/detail/${id}.html`;
    const root = document(await this.client.text(detailUrl));
    const detail = one('.book-detail', root) ?? one('.forum-detail', root);
    if (!detail) throw new Error('书籍信息获取失败');
    const authorItem = all('ul.book-detail li', root).find(item => text(item).includes('作者'));
    const cover = one('.product-gallery img', root);
    const tags = [...new Set(all('section.widget-tags.m-t-20 a.tag, section.widget-tags a.tag', root).map(text).filter(Boolean))];
    return {
      id, url: detailUrl, title: text(one('h2', detail)),
      author: authorItem ? text(one('a', authorItem)) || '未知作者' : '未知作者',
      coverUrl: cover ? absoluteUrl('https://www.esjzone.cc', attr(cover, 'src') ?? attr(cover, 'data-src') ?? '') : undefined,
      tags, status: '连载中', description: text(one('.description', root)) || undefined,
    };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const root = document(await this.client.text(`https://www.esjzone.cc/detail/${novel.id}.html`));
    const list = one('#chapterList', root);
    if (!list) throw new Error('目录获取为空');
    const volumes: Volume[] = [];
    let volume: Volume | undefined;
    let grouped = false;
    const readChapter = (link: Element): Chapter => ({ title: attr(link, 'data-title') ?? text(link), url: attr(link, 'href') ? absoluteUrl('https://www.esjzone.cc', attr(link, 'href') as string) : undefined });
    for (const node of list.children) {
      if (node.type !== 'tag') continue;
      if (node.name === 'details') {
        if (volume) volumes.push(volume);
        volume = { title: text(one('summary', node)), chapters: all('a', node).map(readChapter) };
        grouped = true;
      } else if (node.name === 'a') {
        if (!volume || grouped) {
          if (volume) volumes.push(volume);
          volume = { title: '', chapters: [] };
          grouped = false;
        }
        volume.chapters.push(readChapter(node));
      }
    }
    if (volume) volumes.push(volume);
    if (!volumes.some(item => item.chapters.length)) throw new Error('目录获取为空');
    return { novel, volumes };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.client.text(chapter.url));
    const content = one('.forum-content', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    remove(all('h3, footer, .comment', content));
    return { title: chapter.title, body: html(content.children) };
  }

  async getImage(url: string) { return this.client.bytes(url); }
}
