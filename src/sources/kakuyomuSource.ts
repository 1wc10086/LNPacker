import { HttpClient } from '../core/http';
import { all, cloneNodes, document, html, one, remove } from '../core/html';
import type { Catalog, Chapter, Novel, NovelSource, Volume } from '../core/types';

const kakuyomuUrl = /kakuyomu\.jp\/works\/(\d+)/;
const graphqlUrl = 'https://kakuyomu.jp/graphql';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
type Episode = { id: string; title: string };
type Section = { chapter: { title: string }; episodeUnions: Episode[] };
type WorkInfo = { work: { title: string; author: { name: string }; catchphrase?: string } };
type WorkToc = { work: { tableOfContents: Section[] } };

export class KakuyomuSource implements NovelSource {
  readonly name = 'カクヨム';
  private readonly client = new HttpClient({ 'User-Agent': userAgent, 'Content-Type': 'application/json' }, 3000, 5000);

  supports(url: string) { return kakuyomuUrl.test(url); }

  async getNovel(url: string): Promise<Novel> {
    const id = kakuyomuUrl.exec(url)?.[1];
    if (!id) throw new Error('不支持的小说地址');
    const info = await this.graphql<WorkInfo>('GetWorkInfo', `query GetWorkInfo($workId: ID!) { work(id: $workId) { title author { name } catchphrase } }`, { workId: id });
    return { id, url: `https://kakuyomu.jp/works/${id}`, title: info.work.title, author: info.work.author.name, status: '連載中', tags: [], description: info.work.catchphrase || undefined };
  }

  async getCatalog(novel: Novel): Promise<Catalog> {
    const toc = await this.graphql<WorkToc>('GetWorkToc', `query GetWorkToc($workId: ID!) { work(id: $workId) { tableOfContents { chapter { title } episodeUnions { ... on Episode { id title } } } } }`, { workId: novel.id });
    const volumes: Volume[] = toc.work.tableOfContents.map(section => ({
      title: section.chapter?.title ?? '',
      chapters: section.episodeUnions.map(episode => ({ title: episode.title, url: `https://kakuyomu.jp/works/${novel.id}/episodes/${episode.id}` })),
    }));
    if (!volumes.some(volume => volume.chapters.length)) throw new Error('目录获取为空');
    return { novel, volumes };
  }

  async getChapter(chapter: Chapter): Promise<{ title: string; body: string }> {
    if (!chapter.url) throw new Error('缺少章节地址');
    const root = document(await this.client.text(chapter.url, { Accept: 'text/html' }));
    const content = one('.widget-episodeBody', root);
    if (!content) throw new Error(`章节内容获取失败: ${chapter.url}`);
    remove(all('script, style', content));
    return { title: chapter.title, body: html(cloneNodes(content.children)) };
  }

  async getImage(url: string) { return this.client.bytes(url); }

  private async graphql<T>(operation: string, query: string, variables: Record<string, string>): Promise<T> {
    const data = JSON.parse(await this.client.post(graphqlUrl, JSON.stringify({ operationName: operation, query, variables }))) as { data?: T; errors?: { message: string }[] };
    if (data.errors?.length) throw new Error(data.errors[0].message);
    return data.data as T;
  }
}
