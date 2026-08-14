import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, cloneNodes, document, html, one, remove, replaceImageSources, text } from '../core/html';
import { chapterIdFromPage, parseChapterLog, restoreParagraphs } from '../core/restore';
import { decodeBase64 } from '../core/crypto';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const biliUrl = /(?:linovelib|bilinovel)\.com\/(?:novel|download)\/(\d+)/;
const biliDomain = 'https://www.bilinovel.com';

export class BiliSource implements NovelSource {
  readonly name = '哔哩轻小说';
  private readonly client = new HttpClient({ Accept: '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9', Cookie: 'night=0', Referer: biliDomain, 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36' });
  private scriptCache = new Map<string, string>();
  supports(url: string) { return biliUrl.test(url); }
  async getNovel(url: string): Promise<Novel> {
    const id = biliUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const root = document(await this.client.text(`${biliDomain}/novel/${id}.html`));
    const cover = attr(one('.book-layout img', root), 'src');
    return { id, url, title: text(one('.book-title', root)), alias: text(one('.backupname .bkname-body.gray', root)) || undefined, coverUrl: cover ? absoluteUrl(biliDomain, cover) : undefined, tags: all('.book-cell .book-meta span em', root).map(text), publisher: text(one('.tag-small.orange', root)) || undefined, status: text(one('.book-cell .book-meta + .book-meta', root)), author: text(one('.book-rand-a span', root)), description: text(one('#bookSummary content', root)) || undefined };
  }
  async getCatalog(novel: Novel): Promise<Catalog> {
    const root = document(await this.client.text(`${biliDomain}/novel/${novel.id}/catalog`));
    replaceImageSources(root, biliDomain);
    const volumes: Volume[] = [];
    let volume: Volume | undefined = one('.chapter-bar', root) ? undefined : { title: '', chapters: [] };
    for (const item of all('.volume-chapters > li', root)) {
      if (item.attribs.class?.includes('chapter-bar')) { if (volume) volumes.push(volume); volume = { title: text(item), chapters: [] }; }
      else if (item.attribs.class?.includes('volume-cover') && volume) volume.coverUrl = attr(one('a img', item), 'src');
      else if (item.attribs.class?.includes('jsChapter') && volume) { const link = one('a', item); const href = attr(link, 'href'); volume.chapters.push({ title: text(link), url: !href?.includes('javascript') ? absoluteUrl(biliDomain, href ?? '') : undefined }); }
    }
    if (volume) volumes.push(volume);
    if (!volumes.length) throw new Error('目录获取为空');
    return { novel, volumes };
  }
  async getChapter(chapter: Chapter, catalog: Catalog): Promise<{ title: string; body: string }> {
    let url = chapter.url ?? await this.resolveChapterUrl(chapter, catalog);
    if (!url) throw new Error(`无法定位章节: ${chapter.title}`);
    const pages: string[] = [];
    let title = chapter.title;
    while (url) {
      const source = await this.client.text(url);
      const root = document(source);
      if (!url.includes('_')) title = text(one('#atitle', root)) || title;
      const content = one('#acontent', root) ?? one('.bcontent', root);
      if (!content) throw new Error(`章节内容获取失败: ${url}`);
      remove(['div', 'ins', 'figure', 'fig', 'br', 'script', '.tp', '.bd'].flatMap(selector => all(selector, content)));
      remove(all('*', content).filter(item => /[a-z]\d{4}/.test(item.name)));
      const script = all('script', root).find(item => attr(item, 'src')?.includes('chapterlog.js?v'));
      const id = chapterIdFromPage(source);
      if (script && id) { const scriptUrl = absoluteUrl(biliDomain, attr(script, 'src') ?? ''); const code = this.scriptCache.get(scriptUrl) ?? await this.client.text(scriptUrl); this.scriptCache.set(scriptUrl, code); const params = parseChapterLog(code, id); if (params) restoreParagraphs(content, params); }
      replaceImageSources(content, biliDomain);
      pages.push(html(cloneNodes(content.children)));
      const navigation = /url_previous:'(.*?)',url_next:'(.*?)'/.exec(source);
      const next = one('#footlink a.nextlink', root);
      url = navigation && text(next).match(/^下一[页頁]$/) ? absoluteUrl(biliDomain, navigation[2]) : '';
    }
    return { title, body: pages.join('').replace(/\n/g, '') };
  }
  async getImage(url: string) {
    if (url.startsWith('data:image')) return decodeDataImage(url);
    return this.client.bytes(normalizeBiliImageUrl(url));
  }
  private async resolveChapterUrl(chapter: Chapter, catalog: Catalog) {
    const chapters = catalog.volumes.flatMap(volume => volume.chapters); const index = chapters.indexOf(chapter);
    const next = chapters[index + 1];
    if (next?.url) { const source = await this.client.text(next.url); const nav = /url_previous:'(.*?)',url_next:'(.*?)'/.exec(source); const previous = one('#footlink a.prevlink', document(source)); if (nav && !text(previous).match(/^上一[页頁]$/)) return absoluteUrl(biliDomain, nav[1]); }
    const previous = chapters[index - 1]; if (!previous?.url) return undefined; let url = previous.url;
    for (let probes = 0; probes < 20; probes += 1) { const source = await this.client.text(url); const root = document(source); const nav = /url_previous:'(.*?)',url_next:'(.*?)'/.exec(source); const nextLink = one('#footlink a.nextlink', root); if (!nav) return undefined; if (!text(nextLink).match(/^下一[页頁]$/)) return absoluteUrl(biliDomain, nav[2]); url = absoluteUrl(biliDomain, nav[2]); }
    return undefined;
  }
}

export const normalizeBiliImageUrl = (url: string) => url.replace(/^https:\/\/https:\/\//, 'https://').replaceAll('𝘣', 'b').replace(/#.*$/, '');

function decodeDataImage(url: string) {
  const match = /^data:image\/[^;,]+;base64,(.+)$/i.exec(url);
  if (!match) throw new Error('不支持的内嵌图片格式');
  return decodeBase64(match[1]);
}
