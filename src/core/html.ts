import { selectAll, selectOne } from 'css-select';
import { DomUtils } from 'htmlparser2';
import { cloneNode, Element, type AnyNode, type ChildNode, Text } from 'domhandler';
import { parseDocument } from 'htmlparser2';
import { render } from 'dom-serializer';

export const document = (html: string) => parseDocument(html);
export const one = (selector: string, root: AnyNode) => selectOne(selector, root) as Element | null;
export const all = (selector: string, root: AnyNode) => selectAll(selector, root) as Element[];
export const text = (node: AnyNode | null | undefined) => (node ? DomUtils.textContent(node).replace(/\s+/g, ' ').trim() : '');
export const attr = (node: Element | null | undefined, name: string) => node?.attribs?.[name];
export const html = (nodes: AnyNode | AnyNode[]) => render(nodes, { xmlMode: false });

export const remove = (nodes: ChildNode[]) => nodes.forEach(node => DomUtils.removeElement(node));
export const unwrap = (element: Element) => {
  const parent = element.parent;
  if (!parent) return;
  const children = [...element.children];
  for (const child of children) DomUtils.appendChild(parent, child);
  DomUtils.removeElement(element);
};

export const cloneNodes = (nodes: ChildNode[]) => nodes.map(node => cloneNode(node, true));
export const paragraph = (value: string) => new Element('p', {}, [new Text(value)]);
export const xhtml = (title: string, body: string, hasStyle: boolean) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><title>${escapeXml(title)}</title>${hasStyle ? '<link rel="stylesheet" type="text/css" href="styles/style.css" />' : ''}</head><body>${body}</body></html>`;
export const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] ?? char));

export const replaceImageSources = (root: AnyNode, base: string) => {
  for (const image of all('img', root)) {
    const source = attr(image, 'data-src') ?? attr(image, 'src');
    if (!source || source.includes('<')) {
      DomUtils.removeElement(image);
      continue;
    }
    image.attribs = { src: absoluteSource(base, source), alt: attr(image, 'alt') ?? '' };
  }
};

const absoluteSource = (base: string, source: string) => source.startsWith('data:image') || /^https?:\/\//i.test(source) ? source : new URL(source.replace(/^\/\//, 'https://'), base).toString();
