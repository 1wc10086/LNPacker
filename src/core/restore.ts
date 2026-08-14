import { Element, type ChildNode } from 'domhandler';
import { DomUtils } from 'htmlparser2';

type Params = { fixedLength: number; seed: number; a: number; c: number; mod: number };
type Template = { fixedLength: number; multiplier: number; offset: number; a: number; c: number; mod: number };

export function chapterIdFromPage(page: string) { return /chapterid\s*:\s*['"](\d+)['"]/.exec(page)?.[1]; }

export function restoreParagraphs(content: Element, params: Params) {
  const children: ChildNode[] = [...content.children]; const slots: number[] = []; const paragraphs: Element[] = [];
  children.forEach((node, index) => { if (node.type === 'tag' && (node as Element).name === 'p' && DomUtils.getInnerHTML(node).replace(/\s/g, '')) { slots.push(index); paragraphs.push(node as Element); } });
  const order = Array.from({ length: paragraphs.length }, (_, index) => index); let seed = params.seed;
  for (let index = order.length - 1; index >= params.fixedLength + 1; index -= 1) { seed = (seed * params.a + params.c) % params.mod; const target = params.fixedLength + Math.floor(seed / params.mod * (index - params.fixedLength + 1)); [order[index], order[target]] = [order[target], order[index]]; }
  const restored = [...paragraphs]; paragraphs.forEach((item, index) => { restored[order[index]] = item; }); slots.forEach((slot, index) => { children[slot] = restored[index]; }); content.children = children; children.forEach(child => { child.parent = content; });
}

export function parseChapterLog(script: string, chapterId: string): Params | undefined {
  const template = parsePlain(script) ?? parseObfuscated(script); if (!template) return undefined;
  return { fixedLength: template.fixedLength, seed: Number(chapterId) * template.multiplier + template.offset, a: template.a, c: template.c, mod: template.mod };
}

function parsePlain(source: string): Template | undefined {
  const fixed = trailing(source, /if\s*\(\s*[_$a-zA-Z0-9]+\s*>\s*/, ')'); const assignment = new RegExp('=\\s*(.+?Number\\s*\\(\\s*chapterId\\s*\\).+?)\\s*;'); const lcgAssignment = new RegExp('=\\s*(\\(\\s*[_$a-zA-Z0-9]+\\s*\\*.+?\\)\\s*%\\s*.+?)\\s*;'); const seed = assignment.exec(source)?.[1]; const lcg = lcgAssignment.exec(source)?.[1];
  if (!fixed || !seed || !lcg) return undefined; const fixedLength = evaluate(strip(fixed)); const offset = variable(seed, 'chapterId', 0); const one = variable(seed, 'chapterId', 1); const parts = splitTop(lcg, '%'); if (fixedLength === undefined || offset === undefined || one === undefined || parts.length !== 2) return undefined; const mod = evaluate(parts[1]); const left = strip(parts[0]); const name = /[_$a-zA-Z][_$a-zA-Z0-9]*/.exec(left)?.[0]; const c = name ? variable(left, name, 0) : undefined; const a1 = name ? variable(left, name, 1) : undefined; return mod && c !== undefined && a1 !== undefined ? { fixedLength, multiplier: one - offset, offset, a: a1 - c, c, mod } : undefined;
}
function parseObfuscated(source: string): Template | undefined {
  const seed = /var\s+[_$a-zA-Z0-9]+\s*=\s*[^;]*?Number\s*\(\s*[_$a-zA-Z0-9]+\s*\)\s*,\s*([^,)]+?)\s*\)\s*,\s*([^,)]+?)\s*\)\s*,/g; const lcg = /([_$a-zA-Z0-9]+)\s*=\s*[^;]*?\(\s*\1\s*,\s*([^,)]+?)\s*\)\s*,\s*([^,)]+?)\s*\)\s*,\s*([^;)]+?)\s*\)\s*;/g;
  for (const seedMatch of source.matchAll(seed)) for (const lcgMatch of source.matchAll(lcg)) { const multiplier = evaluate(seedMatch[1]); const offset = evaluate(seedMatch[2]); const a = evaluate(lcgMatch[2]); const c = evaluate(lcgMatch[3]); const mod = evaluate(lcgMatch[4]); if (multiplier && offset !== undefined && a && c !== undefined && mod && mod > a && mod > c) return { fixedLength: 20, multiplier, offset, a, c, mod }; } return undefined;
}
function variable(expression: string, name: string, value: number) { return evaluate(expression.replace(new RegExp(`Number\\s*\\(\\s*${name}\\s*\\)`, 'g'), String(value)).replace(new RegExp(`\\b${name}\\b`, 'g'), String(value))); }
function splitTop(value: string, operator: string) { const parts: string[] = []; let start = 0; let depth = 0; for (let index = 0; index < value.length; index += 1) { if (value[index] === '(') depth += 1; else if (value[index] === ')') depth -= 1; else if (!depth && value.startsWith(operator, index)) { parts.push(value.slice(start, index).trim()); start = index + operator.length; } } return [...parts, value.slice(start).trim()]; }
function strip(value: string) { let result = value.trim(); while (result.startsWith('(') && result.endsWith(')')) { let depth = 0; let wraps = true; for (let index = 0; index < result.length; index += 1) { if (result[index] === '(') depth += 1; if (result[index] === ')' && --depth === 0 && index !== result.length - 1) wraps = false; } if (!wraps) break; result = result.slice(1, -1).trim(); } return result; }
function trailing(value: string, start: RegExp, terminator: string) { const match = start.exec(value); if (!match) return undefined; let depth = 0; for (let index = match.index + match[0].length; index < value.length; index += 1) { if (value[index] === '(') depth += 1; else if (value[index] === ')') { if (!depth && terminator === ')') return value.slice(match.index + match[0].length, index).trim(); depth -= 1; } else if (!depth && value[index] === terminator) return value.slice(match.index + match[0].length, index).trim(); } return undefined; }
function evaluate(source: string): number | undefined { try { if (!/^[\d\sa-fxX()+\-*/%^~<>]+$/.test(source)) return undefined; // The whitelist permits only integer literals and operators from chapterlog.js.
  // eslint-disable-next-line no-new-func
  return Function(`return (${source.replace(/>>>/g, '>>')})`)() as number; } catch { return undefined; } }
