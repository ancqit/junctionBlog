import {
  DayTemplate,
  HourBlock,
  SpanEstimate,
  WeekEstimate,
} from '../models/blog.models';

export function clampHour(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(23, Math.max(0, Math.floor(value)));
}

export function normalizeRange(startHour: number, endHour: number): { start: number; end: number } {
  const start = clampHour(startHour);
  let end = Math.min(24, Math.max(1, Math.floor(endHour)));
  if (end <= start) {
    end = Math.min(24, start + 1);
  }
  return { start, end };
}

export function hoursInBlock(block: HourBlock): number {
  const { start, end } = normalizeRange(block.startHour, block.endHour);
  return end - start;
}

export function occupiedHours(blocks: HourBlock[]): Set<number> {
  const hours = new Set<number>();
  for (const block of blocks) {
    const { start, end } = normalizeRange(block.startHour, block.endHour);
    for (let hour = start; hour < end; hour += 1) {
      hours.add(hour);
    }
  }
  return hours;
}

export function overlapsExisting(blocks: HourBlock[], startHour: number, endHour: number): boolean {
  const taken = occupiedHours(blocks);
  const { start, end } = normalizeRange(startHour, endHour);
  for (let hour = start; hour < end; hour += 1) {
    if (taken.has(hour)) {
      return true;
    }
  }
  return false;
}

export function summarizeDay(template: DayTemplate): WeekEstimate {
  const taken = occupiedHours(template.blocks);
  let activeHours = 0;
  let restHours = 0;
  let sleepHours = 0;
  for (const block of template.blocks) {
    const span = hoursInBlock(block);
    if (block.kind === 'sleep') {
      sleepHours += span;
    } else if (block.kind === 'rest') {
      restHours += span;
    } else {
      activeHours += span;
    }
  }
  return {
    remainingHours: Math.max(0, 24 - taken.size),
    activeHours,
    restHours,
    sleepHours,
  };
}

export function sleepWakeBlocks(sleepTime: string, wakeTime: string): HourBlock[] {
  const sleep = parseHour(sleepTime);
  const wake = parseHour(wakeTime);
  if (sleep === wake) {
    return [];
  }
  if (sleep < wake) {
    return [{ startHour: sleep, endHour: wake, activity: 'sleep', kind: 'sleep' }];
  }
  return [
    { startHour: sleep, endHour: 24, activity: 'sleep', kind: 'sleep' },
    { startHour: 0, endHour: wake, activity: 'sleep', kind: 'sleep' },
  ];
}

export function parseHour(value: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

export function formatHour(hour: number): string {
  const clamped = Math.min(24, Math.max(0, hour));
  const display = clamped === 24 ? 0 : clamped;
  return `${String(display).padStart(2, '0')}:00`;
}

export function estimateSpan(
  restDays: number[],
  activeDay: DayTemplate,
  restDay: DayTemplate,
): SpanEstimate {
  const uniqueRest = new Set(restDays.filter((day) => day >= 0 && day <= 6));
  const restCount = uniqueRest.size;
  const activeCount = 7 - restCount;
  const active = summarizeDay(activeDay);
  const rest = summarizeDay(restDay);
  const weekActiveHours = active.activeHours * activeCount + rest.activeHours * restCount;
  const weekRestHours = active.restHours * activeCount + rest.restHours * restCount;
  const weekSleepHours = active.sleepHours * activeCount + rest.sleepHours * restCount;
  return {
    weekActiveHours,
    weekRestHours,
    weekSleepHours,
    monthActiveHours: Math.round(weekActiveHours * 4.345),
    yearActiveHours: weekActiveHours * 52,
  };
}

export function nameTag(displayName: string, userNumber: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  return `${slug || 'anon'}#${userNumber}`;
}

export function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}
