export type TrendTone = 'positive' | 'negative' | 'neutral';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendDescriptor {
  direction: TrendDirection;
  tone: TrendTone;
  emphasis: string;
  label: string;
}

interface BuildTrendDescriptorOptions {
  current: number;
  previous: number;
  compareLabel: string;
  formatter?: (value: number) => string;
  goodWhenIncrease?: boolean;
  neutralLabel?: string;
}

export function formatCompactChange(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1000) {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: absolute >= 10000 ? 0 : 1,
    }).format(absolute);
  }

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: absolute >= 100 ? 0 : 1,
  }).format(absolute);
}

export function buildTrendDescriptor({
  current,
  previous,
  compareLabel,
  formatter = formatCompactChange,
  goodWhenIncrease = true,
  neutralLabel,
}: BuildTrendDescriptorOptions): TrendDescriptor {
  const delta = current - previous;

  if (delta === 0) {
    return {
      direction: 'flat',
      tone: 'neutral',
      emphasis: '0%',
      label: neutralLabel ?? `vs ${compareLabel}`,
    };
  }

  if (previous === 0) {
    const tone = current > 0 === goodWhenIncrease ? 'positive' : 'negative';

    return {
      direction: delta > 0 ? 'up' : 'down',
      tone,
      emphasis: formatter(delta),
      label: `${delta > 0 ? 'from' : 'below'} zero ${compareLabel}`,
    };
  }

  const percentChange = Math.abs((delta / previous) * 100);
  const roundedPercent =
    percentChange >= 10
      ? Math.round(percentChange)
      : Number(percentChange.toFixed(1));

  const movementIsGood = delta > 0 ? goodWhenIncrease : !goodWhenIncrease;

  return {
    direction: delta > 0 ? 'up' : 'down',
    tone: movementIsGood ? 'positive' : 'negative',
    emphasis: `${roundedPercent}%`,
    label: `vs ${compareLabel}`,
  };
}

export function buildSparklinePoints(
  values: number[],
  width: number = 320,
  height: number = 104,
  padding: number = 8
): string {
  if (values.length <= 1) {
    return `${padding},${height - padding} ${width - padding},${height - padding}`;
  }

  const safeValues = values.map((value) => (Number.isFinite(value) ? value : 0));
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const step = (width - padding * 2) / (safeValues.length - 1);

  return safeValues
    .map((value, index) => {
      const x = padding + step * index;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');
}
