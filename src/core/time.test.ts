import { ambientAt, clockText, darkness, DAY, dayOver, LIGHT_COLORS, MINUTES_PER_SECOND, phaseAt } from './time';

describe('game day', () => {
  it('lasts 12–15 real minutes (spec acceptance)', () => {
    const realMinutes = (DAY.endMinutes - DAY.startMinutes) / MINUTES_PER_SECOND / 60;
    expect(realMinutes).toBeGreaterThanOrEqual(12);
    expect(realMinutes).toBeLessThanOrEqual(15);
  });

  it('goes morning → day → evening → night', () => {
    expect(phaseAt(6 * 60)).toBe('morning');
    expect(phaseAt(12 * 60)).toBe('day');
    expect(phaseAt(18 * 60)).toBe('evening');
    expect(phaseAt(22 * 60)).toBe('night');
    expect(phaseAt(25 * 60)).toBe('night'); // 01:00 of the same game day
  });

  it('uses the light tokens once each phase has started', () => {
    expect(ambientAt(6 * 60)).toBe(LIGHT_COLORS.morning); // the day starts in morning light
    expect(ambientAt(8 * 60)).toBe(LIGHT_COLORS.morning);
    expect(ambientAt(21 * 60)).toBe(LIGHT_COLORS.night);
    expect(ambientAt(13 * 60)).toBe(LIGHT_COLORS.day);
    expect(ambientAt(19 * 60)).toBe(LIGHT_COLORS.evening);
    expect(ambientAt(23 * 60)).toBe(LIGHT_COLORS.night);
    expect(ambientAt(25 * 60)).toBe(LIGHT_COLORS.night);
  });

  it('blends smoothly instead of jumping', () => {
    const a = ambientAt(20 * 60);
    const b = ambientAt(20 * 60 + 30);
    const c = ambientAt(21 * 60);
    expect(a).toBe(LIGHT_COLORS.evening);
    expect(b).not.toBe(a);
    expect(b).not.toBe(c);
    expect(c).toBe(LIGHT_COLORS.night);
  });

  it('darkness is 0 by day and 1 at night', () => {
    expect(darkness(13 * 60)).toBe(0);
    expect(darkness(6 * 60)).toBeLessThan(0.1); // no fireflies at breakfast
    expect(darkness(23 * 60)).toBeCloseTo(1, 5);
    expect(darkness(19 * 60)).toBeGreaterThan(0);
    expect(darkness(19 * 60)).toBeLessThan(1);
  });

  it('ends at 02:00', () => {
    expect(dayOver(DAY.endMinutes - 1)).toBe(false);
    expect(dayOver(DAY.endMinutes)).toBe(true);
    expect(clockText(DAY.endMinutes)).toBe('02:00');
    expect(clockText(6 * 60 + 5.7)).toBe('06:05');
  });
});
