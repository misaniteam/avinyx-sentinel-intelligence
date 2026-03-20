import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure utility functions: canvasToPng and downloadBlob.
// captureElement and canvasToPdf depend on html2canvas and jsPDF which
// require a real DOM/canvas, so we skip those in unit tests.

describe('canvasToPng', () => {
  it('resolves with a blob when canvas.toBlob succeeds', async () => {
    const { canvasToPng } = await import('../client-export');

    const fakeBlob = new Blob(['png-data'], { type: 'image/png' });
    const fakeCanvas = {
      toBlob: vi.fn((cb: (blob: Blob | null) => void, type: string) => {
        cb(fakeBlob);
      }),
    } as unknown as HTMLCanvasElement;

    const result = await canvasToPng(fakeCanvas);
    expect(result).toBe(fakeBlob);
    expect(fakeCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it('rejects when canvas.toBlob returns null', async () => {
    const { canvasToPng } = await import('../client-export');

    const fakeCanvas = {
      toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
        cb(null);
      }),
    } as unknown as HTMLCanvasElement;

    await expect(canvasToPng(fakeCanvas)).rejects.toThrow('Failed to create PNG blob');
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor element, clicks it, and revokes the URL', async () => {
    const { downloadBlob } = await import('../client-export');

    const fakeUrl = 'blob:http://localhost/fake-url';
    // jsdom doesn't provide URL.createObjectURL, so we assign stubs directly
    const createObjectURLMock = vi.fn().mockReturnValue(fakeUrl);
    const revokeObjectURLMock = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLMock;
    globalThis.URL.revokeObjectURL = revokeObjectURLMock;

    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Spy on click of the appended anchor
      if (node instanceof HTMLAnchorElement) {
        node.click = clickSpy;
      }
      return node;
    });
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const blob = new Blob(['test'], { type: 'text/plain' });
    downloadBlob(blob, 'test-file.txt');

    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(appendChildSpy).toHaveBeenCalled();

    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toBe(fakeUrl);
    expect(anchor.download).toBe('test-file.txt');

    expect(clickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(fakeUrl);
  });
});
