'use client';

import { useExport } from '@/lib/export/use-export';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExportableContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ExportableContainer({ title, children, className }: ExportableContainerProps) {
  const { exportRef, exportToPdf, exportToPng, isExporting } = useExport();
  const t = useTranslations("common");

  return (
    <div className={className}>
      <div className="flex justify-end gap-2 mb-2" data-export-hide>
        <Button         
          onClick={() => exportToPdf(title)}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-1 text-theme-primary" />
          {t("exportPdf")}
        </Button>
        <Button
          onClick={() => exportToPng(title.toLowerCase().replace(/\s+/g, '-'))}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-1 text-theme-primary" />
          {t("exportPng")}
        </Button>
      </div>
      <div ref={exportRef}>
        {children}
      </div>
    </div>
  );
}
