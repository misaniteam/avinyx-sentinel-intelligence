'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { widgetRegistry, type WidgetDefinition } from './widget-registry';
import { WidgetContainer } from './widget-container';

const ResponsiveGridLayout = WidthProvider(Responsive);

const STORAGE_KEY = 'sentinel-dashboard-layout';
const WIDGETS_STORAGE_KEY = 'sentinel-dashboard-widgets';

interface WidgetInstance {
  id: string;
  type: string;
}

const DEFAULT_WIDGET_TYPES = [
  'summary-stats',
  'top-feeds',
  'sentiment-trend',
  'platform-breakdown',
  'top-topics',
  'engagement',
  'sentiment-distribution',
];

function getDefaultWidgets(): WidgetInstance[] {
  return DEFAULT_WIDGET_TYPES.map((type) => ({ id: type, type }));
}

function getDefaultLayouts(): Layouts {
  const lg: Layout[] = [
    { i: 'summary-stats', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
    { i: 'top-feeds', x: 0, y: 2, w: 12, h: 5, minW: 4, minH: 4 },
    { i: 'sentiment-trend', x: 0, y: 7, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'platform-breakdown', x: 6, y: 7, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'top-topics', x: 0, y: 11, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'engagement', x: 6, y: 11, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'sentiment-distribution', x: 0, y: 15, w: 6, h: 4, minW: 3, minH: 3 },
  ];
  return { lg };
}

function loadFromStorage<T>(key: string, fallback: () => T): T {
  if (typeof window === 'undefined') return fallback();
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch {
    // ignore parse errors
  }
  return fallback();
}

export function DashboardGrid() {
  const t = useTranslations('dashboard');
  const [widgets, setWidgets] = useState<WidgetInstance[]>(() =>
    loadFromStorage(WIDGETS_STORAGE_KEY, getDefaultWidgets)
  );
  const [layouts, setLayouts] = useState<Layouts>(() =>
    loadFromStorage(STORAGE_KEY, getDefaultLayouts)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save layouts to localStorage with debounce
  const handleLayoutChange = useCallback((_currentLayout: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
      } catch {
        // ignore storage errors
      }
    }, 500);
  }, []);

  // Save widgets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgets));
    } catch {
      // ignore storage errors
    }
  }, [widgets]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setLayouts((prev) => {
      const updated: Layouts = {};
      for (const [bp, layoutArr] of Object.entries(prev)) {
        updated[bp] = (layoutArr as Layout[]).filter((l) => l.i !== widgetId);
      }
      return updated;
    });
  }, []);

  const handleAddWidget = useCallback(
    (definition: WidgetDefinition) => {
      // Generate unique id
      const existingIds = new Set(widgets.map((w) => w.id));
      let id = definition.type;
      let counter = 2;
      while (existingIds.has(id)) {
        id = `${definition.type}-${counter}`;
        counter++;
      }

      const newWidget: WidgetInstance = { id, type: definition.type };
      setWidgets((prev) => [...prev, newWidget]);

      // Add layout entry at the bottom
      const { w, h, minW, minH } = definition.defaultLayout;
      const newLayoutItem: Layout = { i: id, x: 0, y: Infinity, w, h, minW, minH };

      setLayouts((prev) => {
        const updated: Layouts = {};
        for (const [bp, layoutArr] of Object.entries(prev)) {
          updated[bp] = [...(layoutArr as Layout[]), newLayoutItem];
        }
        if (!updated.lg) {
          updated.lg = [newLayoutItem];
        }
        return updated;
      });

      setDialogOpen(false);
    },
    [widgets]
  );

  const handleResetLayout = useCallback(() => {
    setWidgets(getDefaultWidgets());
    setLayouts(getDefaultLayouts());
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(WIDGETS_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const renderedWidgets = useMemo(() => {
    return widgets
      .map((widget) => {
        const definition = widgetRegistry.get(widget.type);
        if (!definition) return null;
        const WidgetComponent = definition.component;
        return (
          <div key={widget.id}>
            <WidgetContainer
              title={t(definition.labelKey)}
              onRemove={() => handleRemoveWidget(widget.id)}
            >
              <WidgetComponent />
            </WidgetContainer>
          </div>
        );
      })
      .filter((w): w is React.ReactElement => w !== null);
  }, [widgets, handleRemoveWidget]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4 text-theme-primary" />
              {t('addWidget')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addWidget')}</DialogTitle>
              <DialogDescription>
                {t('addWidgetDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {Array.from(widgetRegistry.values()).map((def) => {
                const Icon = def.icon;
                return (
                  <Button
                    key={def.type}
                    className="flex h-auto flex-col items-center gap-2 p-4"
                    onClick={() => handleAddWidget(def)}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs">{t(def.labelKey)}</span>
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <Button onClick={handleResetLayout}>
          <RotateCcw className="mr-1 h-4 w-4 text-theme-primary" />
          {t('resetLayout')}
        </Button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".cursor-grab"
        isResizable
        isDraggable
      >
        {renderedWidgets}
      </ResponsiveGridLayout>
    </div>
  );
}
