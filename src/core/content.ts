/**
 * Content as data (spec §9): theme packs and balance numbers live in
 * src/content/*.json, so a new pack is a new JSON file, not new code.
 */
import balanceJson from '../content/balance.json';

export interface Localized {
  uk: string;
  en?: string;
}

export interface ThemePack {
  id: string;
  season: string;
  location: { name: Localized };
  mentor: { name: Localized; portrait: string };
  building: { name: Localized };
  branch: { id: string; name: Localized; effect: Localized };
  resource: { id: string; name: Localized };
  /** One unique item per lab slot; lab N gets uniques[(N - 1) % length]. */
  uniques: { id: string; name: Localized }[];
}

export type Balance = Omit<typeof balanceJson, '_comment'>;
export const BALANCE: Balance = balanceJson;

const packFiles = import.meta.glob<ThemePack>('../content/packs/*.json', { eager: true, import: 'default' });

export const PACKS: Record<string, ThemePack> = Object.fromEntries(
  Object.values(packFiles).map((p) => [p.id, p]),
);

export function getPack(id: string): ThemePack {
  const pack = PACKS[id];
  if (!pack) throw new Error(`Unknown theme pack: ${id}`);
  return pack;
}

export function uniqueItemFor(pack: ThemePack, labNo: number): string {
  return pack.uniques[(labNo - 1) % pack.uniques.length].id;
}
