'use client';

import { useState } from 'react';
import { useNegativeAnalysis } from '@/lib/api/hooks-analytics';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  Share2,
  Users,
  Scale,
  Building,
} from 'lucide-react';
import type { NegativeAnalysis, NegativePoint, Actionable } from '@/types';

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
  medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle },
  low: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  public_statement: MessageSquare,
  policy_response: FileText,
  social_media: Share2,
  community_outreach: Users,
  legal: Scale,
  internal: Building,
};

const THREAT_CONFIG: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-red-500 text-white',
  moderate: 'bg-yellow-500 text-white',
  low: 'bg-green-500 text-white',
};

function NegativePointCard({ point }: { point: NegativePoint }) {
  const t = useTranslations('dashboard');
  const config = SEVERITY_CONFIG[point.severity] || SEVERITY_CONFIG.low;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <config.icon className="h-4 w-4 shrink-0 text-red-500" />
          <span className="font-semibold text-sm truncate">{point.theme}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[10px] ${config.color}`}>
            {point.severity}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {point.sources_count} {t('negativeAnalysis.sources')}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{point.summary}</p>
      {point.sample_titles.length > 0 && (
        <div className="space-y-0.5">
          {point.sample_titles.map((title, i) => (
            <p key={i} className="text-[10px] text-muted-foreground italic truncate">
              &quot;{title}&quot;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionableCard({ action }: { action: Actionable }) {
  const t = useTranslations('dashboard');
  const Icon = TYPE_ICONS[action.type] || FileText;
  const priorityColor = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50/30 dark:bg-green-950/10 p-3 space-y-1.5">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className={`text-[10px] ${priorityColor}`}>
              {action.priority}
            </Badge>
            <span className="text-[10px] text-muted-foreground capitalize">
              {action.type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs leading-relaxed">{action.action}</p>
          {action.addresses_themes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {action.addresses_themes.map((theme) => (
                <span key={theme} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

export default function NegativeAnalysisWidget() {
  const t = useTranslations('dashboard');
  const { data, isLoading, isFetching } = useNegativeAnalysis();
  const queryClient = useQueryClient();
  const [showAllActions, setShowAllActions] = useState(false);

  const handleRefresh = () => {
    queryClient.setQueryData(queryKeys.dashboard.negativeAnalysis, undefined);
    queryClient.fetchQuery({
      queryKey: queryKeys.dashboard.negativeAnalysis,
      queryFn: () => api.get('api/analytics/dashboard/negative-analysis?refresh=true').json<NegativeAnalysis>(),
    });
  };

  if (isLoading) return <AnalysisSkeleton />;

  if (!data || data.negative_points.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-8 w-8 text-green-500" />
        <p>{t('negativeAnalysis.noNegativeArticles')}</p>
      </div>
    );
  }

  const visibleActions = showAllActions ? data.actionables : data.actionables.slice(0, 3);

  return (
    <div className="space-y-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${THREAT_CONFIG[data.overall_threat_level] || THREAT_CONFIG.low}`}>
            {data.overall_threat_level} {t('negativeAnalysis.threat')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {data.analyzed_count} {t('negativeAnalysis.articlesAnalyzed')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary */}
      <p className="text-xs text-muted-foreground leading-relaxed">{data.summary}</p>

      {/* Negative Points */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          {t('negativeAnalysis.negativeThemes')}
        </h4>
        <div className="space-y-2">
          {data.negative_points.map((point, i) => (
            <NegativePointCard key={i} point={point} />
          ))}
        </div>
      </div>

      {/* Actionables */}
      {data.actionables.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            {t('negativeAnalysis.recommendedActions')}
          </h4>
          <div className="space-y-2">
            {visibleActions.map((action, i) => (
              <ActionableCard key={i} action={action} />
            ))}
          </div>
          {data.actionables.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 text-xs"
              onClick={() => setShowAllActions((v) => !v)}
            >
              {showAllActions ? (
                <><ChevronUp className="h-3 w-3 mr-1" />{t('negativeAnalysis.showLess')}</>
              ) : (
                <><ChevronDown className="h-3 w-3 mr-1" />{t('negativeAnalysis.showMore', { count: data.actionables.length - 3 })}</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
