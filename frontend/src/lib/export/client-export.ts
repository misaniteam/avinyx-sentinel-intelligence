import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function captureElement(
  element: HTMLElement,
  options?: { scale?: number; backgroundColor?: string }
): Promise<HTMLCanvasElement> {
  const scale = options?.scale ?? 2;
  const backgroundColor = options?.backgroundColor ?? '#ffffff';

  // Hide elements with data-export-hide attribute
  const hiddenElements: HTMLElement[] = [];
  element.querySelectorAll('[data-export-hide]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    hiddenElements.push(htmlEl);
    htmlEl.style.display = 'none';
  });

  try {
    const canvas = await html2canvas(element, {
      scale,
      backgroundColor,
      useCORS: true,
      logging: false,
    });
    return canvas;
  } finally {
    // Restore hidden elements
    hiddenElements.forEach((el) => {
      el.style.display = '';
    });
  }
}

export function canvasToPdf(canvas: HTMLCanvasElement, title: string): Blob {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('landscape', 'mm', 'a4');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Title
  pdf.setFontSize(16);
  pdf.text(title, margin, margin + 5);

  // Timestamp
  pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 12);

  // Image
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  const maxHeight = pageHeight - margin * 2 - 20;

  const finalWidth = imgHeight > maxHeight ? (maxHeight / imgHeight) * imgWidth : imgWidth;
  const finalHeight = imgHeight > maxHeight ? maxHeight : imgHeight;

  pdf.addImage(imgData, 'JPEG', margin, margin + 18, finalWidth, finalHeight);

  return pdf.output('blob');
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      },
      'image/png'
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { downloadBlob };
