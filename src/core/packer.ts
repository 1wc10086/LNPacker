import { all, document, html, xhtml } from './html';
import { DomUtils } from 'htmlparser2';
import { Element } from 'domhandler';
import { createEpub, type EpubImage, type NavPoint } from './epub';
import type { Catalog, PackOptions, Progress, Volume } from './types';
import type { NovelSource } from './types';
import { imageInfo } from './image';

const style = '.chapter-title { margin-top: 0.5em; font-size: 1.25em; font-weight: 800; text-align: center; }';
const safeName = (name: string) => name.replace(/[:*?"\\/<>|\0　]/g, ' ').replace(/^\.|\.$/g, '').replace(/\s+/g, ' ').trim() || 'novel';

export async function packNovels(source: NovelSource, catalog: Catalog, options: PackOptions, onProgress: (progress: Progress) => void) {
  const groups = options.combineVolumes ? [{ title: catalog.novel.title, volumes: options.volumes }] : options.volumes.map(volume => ({ title: volume.title || catalog.novel.title, volumes: [volume] }));
  const result: { name: string; bytes: Uint8Array }[] = [];
  for (const group of groups) result.push({ name: `${safeName(options.combineVolumes ? catalog.novel.title : `${catalog.novel.title} ${group.title}`)}.epub`, bytes: await packGroup(source, catalog, group.volumes, options.addChapterTitle, onProgress) });
  return result;
}

async function packGroup(source: NovelSource, catalog: Catalog, volumes: Volume[], addChapterTitle: boolean, onProgress: (progress: Progress) => void) {
  const chapters = []; const images: EpubImage[] = []; const navigation: NavPoint[] = []; let imageIndex = 1; let chapterIndex = 1; let completed = 0; const total = volumes.reduce((count, volume) => count + volume.chapters.length, 0);
  const cache = new Map<string, EpubImage>();
  const resolveImage = async (url: string) => {
    if (cache.has(url)) return cache.get(url)!;
    try { const bytes = await source.getImage(url); const info = imageInfo(bytes); if (!info) return undefined; const extension = ({ 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/jpeg': 'jpg' }[info.mediaType] ?? 'jpg'); const item = { href: `images/${String(imageIndex++).padStart(6, '0')}.${extension}`, bytes, mediaType: info.mediaType }; images.push(item); cache.set(url, item); return item; } catch { return undefined; }
  };
  const resolveChapterImages = async (root: ReturnType<typeof document>) => {
    const items = all('img', root).filter(image => Boolean(image.attribs.src));
    for (let index = 0; index < items.length; index += 3) {
      await Promise.all(items.slice(index, index + 3).map(async image => {
        const asset = await resolveImage(image.attribs.src);
        if (asset) image.attribs.src = asset.href;
        else DomUtils.removeElement(image);
      }));
    }
    for (const image of all('img', root)) {
      const wrapper = document('<div class="duokan-image-single"></div>').children[0] as Element | undefined;
      if (!wrapper || !image.parent) continue;
      DomUtils.replaceElement(image, wrapper);
      DomUtils.appendChild(wrapper, image);
    }
  };
  for (const volume of volumes) {
    const children: NavPoint[] = [];
    for (const chapter of volume.chapters) {
      onProgress({ completed, total, label: chapter.title });
      const resolved = await source.getChapter(chapter, catalog);
      const root = document(resolved.body);
      await resolveChapterImages(root);
      const href = `chapter${String(chapterIndex++).padStart(6, '0')}.xhtml`;
      const body = `${addChapterTitle ? `<div class="chapter-title">${resolved.title}</div>` : ''}${html(root.children)}`;
      chapters.push({ href, title: resolved.title, content: xhtml(resolved.title, body, addChapterTitle) }); children.push({ title: resolved.title, href }); completed += 1; onProgress({ completed, total, label: resolved.title });
    }
    if (children.length) navigation.push({ title: volume.title || catalog.novel.title, href: children[0].href, children });
  }
  let cover: string | undefined;
  const preferredCover = volumes.length === 1 ? volumes[0].coverUrl : catalog.novel.coverUrl;
  if (preferredCover) cover = (await resolveImage(preferredCover))?.href;
  if (!cover) cover = images.find(image => { const info = imageInfo(image.bytes); return info ? info.width / info.height < 1 : false; })?.href ?? images[0]?.href;
  return createEpub({ title: volumes.length === 1 && volumes[0].title ? `${catalog.novel.title} ${volumes[0].title}` : catalog.novel.title, author: catalog.novel.author, source: catalog.novel.url, description: catalog.novel.description, publisher: catalog.novel.publisher, tags: catalog.novel.tags, chapters, images, cover, navigation, stylesheet: addChapterTitle ? style : undefined });
}
