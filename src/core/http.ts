const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class HttpClient {
  private lastTextRequest = 0;
  private lastImageRequest = 0;

  constructor(private readonly headers: Record<string, string>, private readonly textGap = 4000, private readonly imageGap = 6000) {}

  async text(url: string, headers?: Record<string, string>, encoding = 'utf-8'): Promise<string> {
    const response = await this.request(url, false, headers);
    if (encoding === 'gb18030' || encoding === 'gbk') return decodeGbk(new Uint8Array(await response.arrayBuffer()));
    return response.text();
  }

  async post(url: string, body: string, headers?: Record<string, string>, encoding = 'utf-8'): Promise<string> {
    const response = await this.request(url, false, { 'Content-Type': 'application/json', ...headers }, 'POST', body);
    if (encoding === 'gb18030' || encoding === 'gbk') return decodeGbk(new Uint8Array(await response.arrayBuffer()));
    return response.text();
  }

  async bytes(url: string, headers?: Record<string, string>): Promise<Uint8Array> {
    return new Uint8Array(await (await this.request(url, true, headers)).arrayBuffer());
  }

  private async request(url: string, image: boolean, headers?: Record<string, string>, method: 'GET' | 'POST' = 'GET', body?: string, attempts = 5, timeoutMs = 60000): Promise<Response> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const now = Date.now();
      const last = image ? this.lastImageRequest : this.lastTextRequest;
      const gap = image ? this.imageGap : this.textGap;
      if (now - last < gap) await sleep(gap - (now - last));
      if (image) this.lastImageRequest = Date.now();
      else this.lastTextRequest = Date.now();
      try {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try { response = await fetch(url, { method, body, headers: { ...this.headers, ...headers }, redirect: 'follow', signal: controller.signal as never }); } finally { clearTimeout(timer); }
        if (response.ok) return response;
        if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (attempt === attempts - 1) throw error;
      }
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
    }
    throw new Error(`请求失败: ${url}`);
  }
}

export const absoluteUrl = (base: string, value: string) => new URL(value, base).toString();

function decodeGbk(bytes: Uint8Array) {
  // fast-gbk has no native dependencies, so it works in Hermes and desktop JS runtimes.
  const createGbk = require('fast-gbk') as () => { decode(data: ArrayLike<number>): string };
  return createGbk().decode(bytes);
}
