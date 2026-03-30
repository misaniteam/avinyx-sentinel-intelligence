import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// jsdom does not provide several DOM APIs that Radix UI needs
// ---------------------------------------------------------------------------
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  // Radix Select calls scrollIntoView on candidates
  Element.prototype.scrollIntoView = vi.fn();

  // Radix needs pointer capture APIs
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

// ---------------------------------------------------------------------------
// Mock API hooks so components render without network calls
// ---------------------------------------------------------------------------
vi.mock('@/lib/api/hooks', () => ({
  useCreateDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadFileDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadFacebookImport: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { DataSourceDialog } from '../data-source-dialog';

// Helper: select a platform from the Radix Select dropdown
async function selectPlatform(label: string) {
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);

  // Radix Select renders both a hidden <option> and a visible <span> for each item.
  // Use getAllByText and click the one inside the Radix select content (role="option").
  await waitFor(() => {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  const option = screen.getByRole('option', { name: label });
  fireEvent.click(option);
}

// ---------------------------------------------------------------------------
// File Upload platform tests
// ---------------------------------------------------------------------------

describe('DataSourceDialog — File Upload platform', () => {
  it('renders "File Upload" option in the platform dropdown', async () => {
    render(
      <DataSourceDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'File Upload' })).toBeInTheDocument();
    });
  });

  it('shows file input area when file_upload platform is selected', async () => {
    render(
      <DataSourceDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );

    await selectPlatform('File Upload');

    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument();
    });
  });

  it('hides poll interval when file_upload platform is selected', async () => {
    render(
      <DataSourceDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );

    await selectPlatform('File Upload');

    await waitFor(() => {
      expect(screen.queryByLabelText('Poll Interval (minutes)')).not.toBeInTheDocument();
    });
  });

  it('shows poll interval for non-file-upload platforms', async () => {
    render(
      <DataSourceDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );

    await selectPlatform('YouTube');

    await waitFor(() => {
      expect(screen.getByText('Poll Interval (minutes)')).toBeInTheDocument();
    });
  });

  it('does not show credentials section for file_upload platform', async () => {
    render(
      <DataSourceDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );

    await selectPlatform('File Upload');

    await waitFor(() => {
      expect(screen.queryByText('Credentials')).not.toBeInTheDocument();
      expect(screen.queryByText('API Key')).not.toBeInTheDocument();
    });
  });
});
