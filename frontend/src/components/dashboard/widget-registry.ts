import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { BarChart3, PieChart, TrendingUp, Activity, Gauge, LayoutGrid, Newspaper, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WidgetDefinition {
  type: string;
  labelKey: string;
  icon: LucideIcon;
  component: LazyExoticComponent<ComponentType>;
  defaultLayout: { w: number; h: number; minW: number; minH: number };
  permission: string;
}

export const widgetRegistry = new Map<string, WidgetDefinition>([
  [
    'summary-stats',
    {
      type: 'summary-stats',
      labelKey: 'widgets.summaryStats',
      icon: LayoutGrid,
      component: lazy(() => import('./widgets/summary-widget')),
      defaultLayout: { w: 12, h: 2, minW: 6, minH: 2 },
      permission: 'dashboard:view',
    },
  ],
  [
    'sentiment-trend',
    {
      type: 'sentiment-trend',
      labelKey: 'widgets.sentimentTrends',
      icon: TrendingUp,
      component: lazy(() => import('./widgets/sentiment-trend-widget')),
      defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
  [
    'platform-breakdown',
    {
      type: 'platform-breakdown',
      labelKey: 'widgets.platformBreakdown',
      icon: PieChart,
      component: lazy(() => import('./widgets/platform-breakdown-widget')),
      defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
  [
    'top-topics',
    {
      type: 'top-topics',
      labelKey: 'widgets.topTopics',
      icon: BarChart3,
      component: lazy(() => import('./widgets/top-topics-widget')),
      defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
  [
    'engagement',
    {
      type: 'engagement',
      labelKey: 'widgets.engagementMetrics',
      icon: Activity,
      component: lazy(() => import('./widgets/engagement-widget')),
      defaultLayout: { w: 6, h: 4, minW: 4, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
  [
    'sentiment-distribution',
    {
      type: 'sentiment-distribution',
      labelKey: 'widgets.sentimentDistribution',
      icon: Gauge,
      component: lazy(() => import('./widgets/sentiment-distribution-widget')),
      defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
  [
    'top-feeds',
    {
      type: 'top-feeds',
      labelKey: 'widgets.topFeeds',
      icon: Newspaper,
      component: lazy(() => import('./widgets/top-feeds-widget')),
      defaultLayout: { w: 6, h: 5, minW: 4, minH: 4 },
      permission: 'dashboard:view',
    },
  ],
  [
    'negative-analysis',
    {
      type: 'negative-analysis',
      labelKey: 'widgets.negativeAnalysis',
      icon: ShieldAlert,
      component: lazy(() => import('./widgets/negative-analysis-widget')),
      defaultLayout: { w: 6, h: 6, minW: 4, minH: 4 },
      permission: 'dashboard:view',
    },
  ],
]);
