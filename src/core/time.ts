/**
 * Game time (spec §4): one game day is about 12–15 real minutes, from 06:00
 * to 02:00 next morning, with morning → day → evening → night lighting.
 */
import { BALANCE } from './content';

export const DAY = BALANCE.day;

/** Game minutes that pass per real second. */
export const MINUTES_PER_SECOND = (DAY.endMinutes - DAY.startMinutes) / DAY.realSeconds;

export type Phase = 'morning' | 'day' | 'evening' | 'night';

/** Lighting tokens (design-system/tokens.css, light-*). */
export const LIGHT_COLORS = {
  morning: 0xfff1d6,
  day: 0xffffff,
  evening: 0xf2b07e,
  night: 0x4a5788,
} as const;

/** Phase start times in minutes since midnight; each blends in over the hour before it. */
const PHASES: [Phase, number][] = [
  ['morning', 6 * 60],
  ['day', 10 * 60],
  ['evening', 17 * 60],
  ['night', 21 * 60],
];
const BLEND = 60;

export function phaseAt(minutes: number): Phase {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m >= 21 * 60 || m < 6 * 60) return 'night';
  if (m >= 17 * 60) return 'evening';
  if (m >= 10 * 60) return 'day';
  return 'morning';
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const lerp = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}

/** Ambient multiply color for the world at this time (smooth between phases). */
export function ambientAt(minutes: number): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  const phase = phaseAt(m);
  const i = PHASES.findIndex(([p]) => p === phase);
  const [next, nextStart] = PHASES[(i + 1) % PHASES.length];
  // Minutes until the next phase starts (wrapping past midnight).
  const until = (nextStart - m + 1440) % 1440;
  if (until > 0 && until <= BLEND) return mix(LIGHT_COLORS[phase], LIGHT_COLORS[next], 1 - until / BLEND);
  return LIGHT_COLORS[phase];
}

/** 0 by day, 1 at full night: how strongly warm lights and fireflies show. */
export function darkness(minutes: number): number {
  const c = ambientAt(minutes);
  const lum = (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
  const nightLum = (0.299 * 0x4a + 0.587 * 0x57 + 0.114 * 0x88) / 255;
  return Math.max(0, Math.min(1, (1 - lum) / (1 - nightLum)));
}

/** True once the day is over (02:00): the heroine falls asleep where she stands. */
export function dayOver(minutes: number): boolean {
  return minutes >= DAY.endMinutes;
}

export function clockText(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
