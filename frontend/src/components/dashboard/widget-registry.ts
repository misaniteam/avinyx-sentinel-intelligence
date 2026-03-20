import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { BarChart3, PieChart, TrendingUp, Activity, Gauge, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WidgetDefinition {
  type: string;
  label: string;
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
      label: 'Summary Statistics',
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
      label: 'Sentiment Trends',
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
      label: 'Platform Breakdown',
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
      label: 'Top Topics',
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
      label: 'Engagement Metrics',
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
      label: 'Sentiment Distribution',
      icon: Gauge,
      component: lazy(() => import('./widgets/sentiment-distribution-widget')),
      defaultLayout: { w: 6, h: 4, minW: 3, minH: 3 },
      permission: 'dashboard:view',
    },
  ],
]);
