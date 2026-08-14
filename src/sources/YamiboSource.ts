import { absoluteUrl, HttpClient } from '../core/http';
import { all, attr, document, html, one, remove, text } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource } from '../core/types';

const threadUrl = /bbs\.yamibo\.com\/(?:thread-(\d+)|forum\.php\?mod=viewthread&tid=(\d+))/;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export class YamiboSource implements NovelSource {
  readonly name = '百合会';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, Accept: 'text/html' }, 4000, 6000);

  supports(url: string) { return threadUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const tid = threadUrl.exec(url)?.slice(1).find(Boolean);
    if (!tid) throw new Error('不支持的小说地址');
    const root = document(await this.client.text(url));
    const title = text(one('#thread_subject', root));
    if (!title) throw new Error('百合会 触发了反爬验证，请稍后重试');
    const firstPost = one('#postlist > div[id^="post_"]', root);
    const author = this.postAuthorUid(firstPost);
    return { id: tid, url: `https://bbs.yamibo.com/thread-${tid}-1-1.html`, title, author: author ?? '未知作者', status: '连载中', tags: [] };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const chapters: Chapter[] = [];
    const pageUrl = (page: number, author?: string) => `https://bbs.yamibo.com/forum.php?mod=viewthread&tid=${novel.id}&page=${page}${author ? `&authorid=${author}` : ''}`;
    const first = document(await this.client.text(pageUrl(1, novel.author)));
    const author = this.postAuthorUid(one('#postlist > div[id^="post_"]', first)) ?? novel.author;
    const maxPage = all('.pg a[href*="page="]', first).reduce((max, link) => Math.max(max, Number(/page=(\d+)/.exec(attr(link, 'href') ?? '')?.[1] ?? 1)), 1);
    for (let page = 1; page <= maxPage; page += 1) {
      const root = page === 1 ? first : document(await this.client.text(pageUrl(page, author)));
      const posts = all('#postlist > div[id^="post_"]', root).filter(post => this.postAuthorUid(post) === author && one('.pcb', post));
      for (const post of posts) {
        const pid = post.attribs.id?.replace('post_', '');
        if (!pid || !one('.pcb', post)) continue;
        chapters.push({ title: `第 ${chapters.length + 1} 楼`, url: `${pageUrl(page, author)}#pid${pid}` });
      }
    }
    if (!chapters.length) throw new Error('目录获取为空');
    return { novel, volumes: [{ title: novel.title, chapters }] };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const pid = /#pid(\d+)/.exec(chapter.url)?.[1];
    const root = document(await this.client.text(chapter.url.replace(/#.*$/, '')));
    const post = pid ? one(`#post_${pid}`, root) ?? one('#postlist > div[id^="post_"]', root) : one('#postlist > div[id^="post_"]', root);
    const pcb = post ? one('.pcb', post) : null;
    if (!pcb) throw new Error(`章节内容获取失败: ${chapter.title}`);
    remove(all('script, style, .pstatus', pcb));
    for (const image of all('img', pcb)) image.attribs.src = attr(image, 'file') ?? attr(image, 'zoomfile') ?? attr(image, 'src') ?? '';
    const textBody = one('.t_f', pcb);
    const attachments = all('.pattl', pcb).map(attach => html(one('a', attach) ?? attach));
    const body = [textBody ? html(textBody.children) : '', ...attachments].filter(Boolean).join('');
    return { title: chapter.title, body };
  }

  async getImage(url: string) {
    return this.client.bytes(absoluteUrl('https://bbs.yamibo.com/', url), { Referer: 'https://bbs.yamibo.com/' });
  }

  private postAuthorUid(post: ReturnType<typeof one> | null) {
    const link = post ? one('.authi a[href*="uid"]', post) : null;
    return /uid[=-](\d+)/.exec(attr(link, 'href') ?? '')?.[1];
  }
}
