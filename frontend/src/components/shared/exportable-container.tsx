'use client';

import { useExport } from '@/lib/export/use-export';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExportableContainerProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function ExportableContainer({ title, children, className }: ExportableContainerProps) {
  const { exportRef, exportToPdf, exportToPng, isExporting } = useExport();

  return (
    <div className={className}>
      <div className="flex justify-end gap-2 mb-2" data-export-hide>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToPdf(title)}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-1" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToPng(title.toLowerCase().replace(/\s+/g, '-'))}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
      </div>
      <div ref={exportRef}>
        {children}
      </div>
    </div>
  );
}
