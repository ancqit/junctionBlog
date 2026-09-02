import { estimateSpan, hoursInBlock, overlapsExisting, sleepWakeBlocks, summarizeDay } from './routine';

describe('routine math', () => {
  it('counts clubbed hours', () => {
    expect(hoursInBlock({ startHour: 9, endHour: 12, activity: 'work', kind: 'active' })).toBe(3);
  });

  it('detects overlapping blocks', () => {
    const blocks = [{ startHour: 9, endHour: 12, activity: 'work', kind: 'active' as const }];
    expect(overlapsExisting(blocks, 11, 13)).toBeTrue();
    expect(overlapsExisting(blocks, 12, 14)).toBeFalse();
  });

  it('splits overnight sleep', () => {
    const blocks = sleepWakeBlocks('22:00', '06:00');
    expect(blocks.length).toBe(2);
    expect(hoursInBlock(blocks[0]) + hoursInBlock(blocks[1])).toBe(8);
  });

  it('reports remaining hours for a day', () => {
    const summary = summarizeDay({
      type: 'active',
      blocks: [
        { startHour: 22, endHour: 24, activity: 'sleep', kind: 'sleep' },
        { startHour: 0, endHour: 6, activity: 'sleep', kind: 'sleep' },
        { startHour: 9, endHour: 17, activity: 'work', kind: 'active' },
      ],
    });
    expect(summary.sleepHours).toBe(8);
    expect(summary.activeHours).toBe(8);
    expect(summary.remainingHours).toBe(8);
  });

  it('projects a week onto month and year', () => {
    const span = estimateSpan(
      [0],
      {
        type: 'active',
        blocks: [{ startHour: 9, endHour: 17, activity: 'work', kind: 'active' }],
      },
      {
        type: 'rest',
        blocks: [{ startHour: 10, endHour: 12, activity: 'walk', kind: 'active' }],
      },
    );
    expect(span.weekActiveHours).toBe(8 * 6 + 2);
    expect(span.yearActiveHours).toBe(span.weekActiveHours * 52);
  });
});
