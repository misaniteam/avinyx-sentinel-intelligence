import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// jsdom does not provide ResizeObserver — Radix UI Dialog needs it
// ---------------------------------------------------------------------------
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// ---------------------------------------------------------------------------
// Mock API hooks so components render without network calls
// ---------------------------------------------------------------------------
vi.mock('@/lib/api/hooks', () => ({
  useCreateDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadFileDataSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { DataSourceDialog } from '../data-source-dialog';

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

    // The platform select trigger should be present
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Wait for the dropdown to appear and check for "File Upload"
    await waitFor(() => {
      expect(screen.getByText('File Upload')).toBeInTheDocument();
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

    // Open platform select and choose "File Upload"
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('File Upload')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('File Upload'));

    // After selecting file_upload, the file input section should render
    await waitFor(() => {
      // The file upload section title from i18n: "Files"
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

    // Select "File Upload" platform
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('File Upload')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('File Upload'));

    // Poll interval field should not be visible
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

    // Select "YouTube" platform
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('YouTube'));

    // Poll interval should be visible for YouTube
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

    // Select "File Upload" platform
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('File Upload')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('File Upload'));

    // There should be no "Credentials" section or API key fields
    await waitFor(() => {
      expect(screen.queryByText('Credentials')).not.toBeInTheDocument();
      expect(screen.queryByText('API Key')).not.toBeInTheDocument();
    });
  });
});
