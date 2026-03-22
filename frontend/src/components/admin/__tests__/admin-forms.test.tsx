import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  useRoles: () => ({
    data: [
      { id: 'role-1', name: 'Admin', description: 'Full access', permissions: ['*'], created_at: '' },
      { id: 'role-2', name: 'Analyst', description: 'Read only', permissions: ['dashboard:view'], created_at: '' },
    ],
  }),
  useCreateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateUser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { UserDialog } from '../user-dialog';
import { RoleDialog } from '../role-dialog';
import { PermissionSelect } from '../permission-select';
import { DeleteConfirmDialog } from '../delete-confirm-dialog';

import type { User, Role } from '@/types';

// ---------------------------------------------------------------------------
// UserDialog
// ---------------------------------------------------------------------------
describe('UserDialog', () => {
  it('renders in create mode', () => {
    render(
      <UserDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );
    // "Add User" appears in both title and submit button
    const matches = screen.getAllByText('Add User');
    expect(matches.length).toBe(2);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders in edit mode with pre-filled data', () => {
    const user: User = {
      id: 'u-1',
      email: 'alice@example.com',
      full_name: 'Alice Smith',
      is_active: true,
      is_super_admin: false,
      tenant_id: 't-1',
      created_at: '2025-01-01T00:00:00Z',
      roles: [
        { id: 'role-1', name: 'Admin', description: 'Full access', permissions: ['*'], created_at: '' },
      ],
    };

    render(
      <UserDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        user={user}
      />
    );
    expect(screen.getByText('Edit User')).toBeInTheDocument();
    // In edit mode email/password fields should NOT be present
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    // Full name should be pre-filled
    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Alice Smith');
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RoleDialog
// ---------------------------------------------------------------------------
describe('RoleDialog', () => {
  it('renders in create mode', () => {
    render(
      <RoleDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
      />
    );
    // "Create Role" appears in both title and submit button
    const matches = screen.getAllByText('Create Role');
    expect(matches.length).toBe(2);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('renders in edit mode with pre-filled data', () => {
    const role: Role = {
      id: 'r-1',
      name: 'Campaign Manager',
      description: 'Manages campaigns',
      permissions: ['campaigns:read', 'campaigns:write'],
      created_at: '2025-01-01T00:00:00Z',
    };

    render(
      <RoleDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        role={role}
      />
    );
    expect(screen.getByText('Edit Role')).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Campaign Manager');
    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(descInput.value).toBe('Manages campaigns');
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PermissionSelect
// ---------------------------------------------------------------------------
describe('PermissionSelect', () => {
  it('renders all permission groups', () => {
    const onChange = vi.fn();
    render(<PermissionSelect value={[]} onChange={onChange} />);
    // Check that resource group labels are rendered
    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.getByText('voters')).toBeInTheDocument();
    expect(screen.getByText('campaigns')).toBeInTheDocument();
    expect(screen.getByText('media')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();
    expect(screen.getByText('reports')).toBeInTheDocument();
    expect(screen.getByText('heatmap')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('roles')).toBeInTheDocument();
    expect(screen.getByText('settings')).toBeInTheDocument();
    expect(screen.getByText('workers')).toBeInTheDocument();
    // "data_sources" is rendered with underscores replaced by spaces
    expect(screen.getByText('data sources')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------
describe('DeleteConfirmDialog', () => {
  it('renders with title and description', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete User?"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Delete User?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows pending state when isPending', () => {
    render(
      <DeleteConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Remove Role?"
        description="All users with this role will lose access."
        onConfirm={vi.fn()}
        isPending={true}
      />
    );
    expect(screen.getByText('Deleting...')).toBeInTheDocument();
  });
});
