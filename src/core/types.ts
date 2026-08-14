export type Novel = {
  id: string;
  title: string;
  author: string;
  status: string;
  url: string;
  alias?: string;
  coverUrl?: string;
  tags: string[];
  publisher?: string;
  description?: string;
  catalogUrl?: string;
};

export type Chapter = { title: string; url?: string };
export type Volume = { title: string; coverUrl?: string; chapters: Chapter[] };
export type Catalog = { novel: Novel; volumes: Volume[] };
export type Progress = { completed: number; total: number; label: string };
export type PackOptions = { combineVolumes: boolean; addChapterTitle: boolean; volumes: Volume[] };

export interface NovelSource {
  readonly name: string;
  supports(url: string): boolean;
  getNovel(url: string): Promise<Novel>;
  getCatalog(novel: Novel): Promise<Catalog>;
  getChapter(chapter: Chapter, catalog: Catalog): Promise<{ title: string; body: string }>;
  getImage(url: string): Promise<Uint8Array>;
}
