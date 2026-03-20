'use client';

import React, { Component, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical, X } from 'lucide-react';

function WidgetSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          <p>Failed to load widget. {this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface WidgetContainerProps {
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
}

export function WidgetContainer({ title, children, onRemove }: WidgetContainerProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto px-4 pb-4 pt-0">
        <WidgetErrorBoundary>
          <Suspense fallback={<WidgetSkeleton />}>
            {children}
          </Suspense>
        </WidgetErrorBoundary>
      </CardContent>
    </Card>
  );
}
