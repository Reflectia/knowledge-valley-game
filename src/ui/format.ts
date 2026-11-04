import type { ISODate } from '@/core/types';

/** Interface date format `ДД.ММ` (design system: «до 06.11»). */
export function dayMonth(iso: ISODate): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

/** Score without trailing zeros: 9, 7.5. */
export function scoreText(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Save a text file through the browser's download. */
export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
