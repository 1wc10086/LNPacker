import type { NovelSource } from '../core/types';
import { AlphapolisSource } from './AlphapolisSource';
import { BiliSource, normalizeBiliImageUrl } from './BiliSource';
import { EsjZoneSource } from './esjzoneSource';
import { HamelnSource } from './HamelnSource';
import { KakuyomuSource } from './kakuyomuSource';
import { LkSource } from './lkSource';
import { MasiroSource } from './MasiroSource';
import { NovelupSource } from './NovelupSource';
import { NovelPieSource } from './novalpieSource';
import { PixivSource } from './PixivSource';
import { SyosetuSource } from './syosetuSource';
import { WenkuSource } from './WenkuSource';
import { YamiboSource } from './YamiboSource';

const sources: NovelSource[] = [
  new BiliSource(),
  new WenkuSource(),
  new NovelPieSource(),
  new EsjZoneSource(),
  new YamiboSource(),
  new MasiroSource(),
  new LkSource(),
  new SyosetuSource(),
  new KakuyomuSource(),
  new NovelupSource(),
  new HamelnSource(),
  new PixivSource(),
  new AlphapolisSource(),
];

export const sourceFor = (url: string) => {
  const source = sources.find(candidate => candidate.supports(url));
  if (!source) throw new Error('暂不支持该链接，目前支持哔哩轻小说、轻小说文库、NovelPie、ESJZone、百合会、真白萌、轻之国度、小説家になろう、カクヨム、ノベ友、ハーメルン、Pixiv、アルファポリス');
  return source;
};

export { AlphapolisSource, BiliSource, EsjZoneSource, HamelnSource, KakuyomuSource, LkSource, MasiroSource, NovelupSource, NovelPieSource, PixivSource, SyosetuSource, WenkuSource, YamiboSource, normalizeBiliImageUrl };
