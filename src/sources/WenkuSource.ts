import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, document, html, one, paragraph, remove, text, unwrap } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const wenkuBookUrl = /wenku8\.net\/book\/(\d+)/;
const wenkuChapterUrl = /wenku8\.net\/novel\/\d+\/(\d+)\//;
const wenkuDomain = 'https://www.wenku8.net';

export class WenkuSource implements NovelSource {
  readonly name = '轻小说文库';
  private readonly client = new HttpClient({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118 Safari/537.36' }, 3000, 3000);
  supports(url: string) { return wenkuBookUrl.test(url) || wenkuChapterUrl.test(url); }
  async getNovel(url: string): Promise<Novel> {
    const id = wenkuBookUrl.exec(url)?.[1] ?? wenkuChapterUrl.exec(url)?.[1]; if (!id) throw new Error('不支持的小说地址');
    const root = document(await this.client.text(`${wenkuDomain}/book/${id}.htm`, undefined, 'gb18030')); const content = one('#content', root); const details = all('table:nth-child(1) tr:nth-child(2) td', content!); const info = all('table', content!)[2]; const tags = text(one('td:nth-child(2) span', info)).replace('作品Tags：', '').split(/\s+/).filter(Boolean); const catalogHref = attr(one('legend + div > a', content!), 'href');
    const cover = attr(one('table img', content!), 'src');
    return { id, url: `${wenkuDomain}/book/${id}.htm`, title: text(one('table:nth-child(1) span b', content!)), coverUrl: cover ? absoluteUrl(wenkuDomain, cover) : undefined, status: text(details[2]).replace('文章状态：', '').trim(), author: text(details[1]).replace('小说作者：', '').trim(), tags, description: text(all('td:nth-child(2) span', info).at(-1)), catalogUrl: catalogHref ? absoluteUrl(wenkuDomain, catalogHref) : undefined };
  }
  async getCatalog(novel: Novel): Promise<Catalog> {
    if (!novel.catalogUrl) throw new Error('缺少目录地址'); const root = document(await this.client.text(novel.catalogUrl, undefined, 'gb18030')); const prefix = novel.catalogUrl.slice(0, novel.catalogUrl.lastIndexOf('/')); const volumes: Volume[] = []; let volume: Volume | undefined;
    for (const cell of all('table td', root)) { if (cell.attribs.class === 'vcss') { if (volume) volumes.push(volume); volume = { title: text(cell), chapters: [] }; } else if (cell.attribs.class === 'ccss' && volume) { const link = one('a', cell); const chapter = { title: text(link), url: `${prefix}/${attr(link, 'href')}` }; chapter.title === '插图' ? volume.chapters.unshift(chapter) : volume.chapters.push(chapter); } }
    if (volume) volumes.push(volume); return { novel, volumes };
  }
  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址'); let source = ''; for (let attempt = 0; attempt < 5; attempt += 1) { source = await this.client.text(chapter.url, undefined, 'gb18030'); if (!source.includes('Cloudflare') || !source.includes('Ray ID')) break; }
    if (source.includes('Cloudflare') && source.includes('Ray ID')) throw new Error('网站拒绝了章节请求'); const content = one('#content', document(source)); if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`); remove(all('#contentdp, br', content)); for (const link of all('a', content)) unwrap(link); const nodes = content.children.flatMap(node => node.type === 'text' && text(node) ? [paragraph(text(node))] : node.type === 'text' ? [] : [node]); return { title: chapter.title, body: html(nodes) };
  }
  async getImage(url: string) { return this.client.bytes(url); }
}
