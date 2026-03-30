import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock recharts to avoid SVG rendering issues in jsdom.
// Each component renders a simple div with a data-testid instead.
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container" style={{ width: 500, height: 300 }}>
      {children}
    </div>
  );
  const MockChart = ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="chart" {...props}>
      {typeof children === 'function' ? null : children}
    </div>
  );
  const MockElement = (props: Record<string, unknown>) => <div {...props} />;

  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockChart,
    Line: MockElement,
    AreaChart: MockChart,
    Area: MockElement,
    BarChart: MockChart,
    Bar: MockElement,
    PieChart: MockChart,
    Pie: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="pie">{children}</div>
    ),
    Cell: MockElement,
    XAxis: MockElement,
    YAxis: MockElement,
    CartesianGrid: MockElement,
    Tooltip: MockElement,
    Legend: MockElement,
    LabelList: MockElement,
  };
});

import { SentimentLineChart } from '../sentiment-line-chart';
import { PlatformPieChart } from '../platform-pie-chart';
import { TopTopicsBarChart } from '../top-topics-bar-chart';
import { EngagementAreaChart } from '../engagement-area-chart';
import SentimentDistributionPie from '../sentiment-distribution-pie';

import type { SentimentTrend, PlatformBreakdown, TopicCount, EngagementPoint } from '@/types';

describe('SentimentLineChart', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(<SentimentLineChart data={[]} />);
    expect(container).toBeTruthy();
  });

  it('renders with sample data', () => {
    const data: SentimentTrend[] = [
      { period_start: '2025-01-01T00:00:00Z', platform: 'twitter', region: null, avg_sentiment: 0.5, total_count: 100 },
      { period_start: '2025-01-02T00:00:00Z', platform: 'twitter', region: null, avg_sentiment: 0.3, total_count: 80 },
      { period_start: '2025-01-01T00:00:00Z', platform: 'facebook', region: null, avg_sentiment: -0.2, total_count: 60 },
    ];
    const { getByTestId } = render(<SentimentLineChart data={data} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with custom height', () => {
    const { getByTestId } = render(<SentimentLineChart data={[]} height={500} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });
});

describe('PlatformPieChart', () => {
  it('renders with sample data', () => {
    const data: PlatformBreakdown[] = [
      { platform: 'twitter', count: 120 },
      { platform: 'facebook', count: 80 },
      { platform: 'instagram', count: 50 },
    ];
    const { getByTestId } = render(<PlatformPieChart data={data} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    const { container } = render(<PlatformPieChart data={[]} />);
    expect(container).toBeTruthy();
  });
});

describe('TopTopicsBarChart', () => {
  it('renders with sample data', () => {
    const data: TopicCount[] = [
      { topic: 'economy', count: 42 },
      { topic: 'healthcare', count: 35 },
      { topic: 'education', count: 28 },
    ];
    const { getByTestId } = render(<TopTopicsBarChart data={data} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    const { container } = render(<TopTopicsBarChart data={[]} />);
    expect(container).toBeTruthy();
  });

  it('accepts a custom limit prop', () => {
    const data: TopicCount[] = Array.from({ length: 20 }, (_, i) => ({
      topic: `topic-${i}`,
      count: 20 - i,
    }));
    const { container } = render(<TopTopicsBarChart data={data} limit={5} />);
    expect(container).toBeTruthy();
  });
});

describe('EngagementAreaChart', () => {
  it('renders with sample data', () => {
    const data: EngagementPoint[] = [
      { period_start: '2025-01-01T00:00:00Z', likes: 100, shares: 50, comments: 30 },
      { period_start: '2025-01-02T00:00:00Z', likes: 120, shares: 60, comments: 40 },
    ];
    const { getByTestId } = render(<EngagementAreaChart data={data} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    const { container } = render(<EngagementAreaChart data={[]} />);
    expect(container).toBeTruthy();
  });
});

describe('SentimentDistributionPie', () => {
  it('renders with sample distribution', () => {
    const distribution = { positive: 45, negative: 20, neutral: 35 };
    const { getByTestId } = render(<SentimentDistributionPie distribution={distribution} />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    const distribution = { positive: 0, negative: 0, neutral: 0 };
    const { container } = render(<SentimentDistributionPie distribution={distribution} />);
    expect(container).toBeTruthy();
  });
});
