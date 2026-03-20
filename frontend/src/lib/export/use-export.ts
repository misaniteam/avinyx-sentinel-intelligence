'use client';

import { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { captureElement, canvasToPdf, canvasToPng, downloadBlob } from './client-export';

export function useExport() {
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPdf = useCallback(async (title: string) => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await captureElement(exportRef.current);
      const blob = canvasToPdf(canvas, title);
      downloadBlob(blob, `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportToPng = useCallback(async (filename: string) => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await captureElement(exportRef.current);
      const blob = await canvasToPng(canvas);
      downloadBlob(blob, `${filename}.png`);
      toast.success('PNG exported successfully');
    } catch (error) {
      console.error('PNG export failed:', error);
      toast.error('Failed to export PNG');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportRef, exportToPdf, exportToPng, isExporting };
}
