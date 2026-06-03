import { describe, expect, it } from 'vitest';
import {
  buildSparklinePoints,
  buildTrendDescriptor,
  formatCompactChange,
} from './dashboardCardUtils';

describe('dashboardCardUtils', () => {
  it('builds positive percentage trends against a prior period', () => {
    expect(
      buildTrendDescriptor({
        current: 2400,
        previous: 2000,
        compareLabel: 'yesterday',
      })
    ).toEqual({
      direction: 'up',
      tone: 'positive',
      emphasis: '20%',
      label: 'vs yesterday',
    });
  });

  it('handles zero baselines without inventing percentages', () => {
    expect(
      buildTrendDescriptor({
        current: 1600,
        previous: 0,
        compareLabel: 'yesterday',
        formatter: (value) => `Rs${value}`,
      })
    ).toEqual({
      direction: 'up',
      tone: 'positive',
      emphasis: 'Rs1600',
      label: 'from zero yesterday',
    });
  });

  it('returns neutral metadata when values do not change', () => {
    expect(
      buildTrendDescriptor({
        current: 500,
        previous: 500,
        compareLabel: 'last week',
      })
    ).toEqual({
      direction: 'flat',
      tone: 'neutral',
      emphasis: '0%',
      label: 'vs last week',
    });
  });

  it('formats large deltas compactly for secondary labels', () => {
    expect(formatCompactChange(12500)).toBe('12K');
  });

  it('builds deterministic sparkline points from a real series', () => {
    expect(buildSparklinePoints([10, 20, 15], 100, 40, 5)).toBe(
      '5,35 50,5 95,20'
    );
  });
});
