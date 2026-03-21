import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionSelect } from '../permission-select';
import { PERMISSION_GROUPS, getAllPermissions, formatPermission } from '@/lib/rbac/permissions';

// ---------------------------------------------------------------------------
// jsdom does not provide ResizeObserver — Radix UI needs it
// ---------------------------------------------------------------------------
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const allPermissions = getAllPermissions();
const totalCount = allPermissions.length;

function renderWithProps(value: string[] = [], onChange = vi.fn()) {
  const result = render(<PermissionSelect value={value} onChange={onChange} />);
  return { ...result, onChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PermissionSelect', () => {
  describe('Rendering', () => {
    it('renders all permission groups', () => {
      renderWithProps();

      for (const group of PERMISSION_GROUPS) {
        // resource names with underscores are rendered with spaces
        const label = group.resource.replaceAll('_', ' ');
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('renders all individual action labels', () => {
      renderWithProps();

      for (const group of PERMISSION_GROUPS) {
        for (const action of group.actions) {
          // There may be duplicate action names across groups (e.g. "read", "write")
          // so we just verify at least one exists
          expect(screen.getAllByText(action).length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe('Selected count display', () => {
    it('shows "0 of N selected" when nothing selected', () => {
      renderWithProps([]);
      expect(screen.getByText(`0 of ${totalCount} selected`)).toBeInTheDocument();
    });

    it('shows correct count when some permissions selected', () => {
      const selected = ['dashboard:view', 'voters:read', 'campaigns:write'];
      renderWithProps(selected);
      expect(screen.getByText(`${selected.length} of ${totalCount} selected`)).toBeInTheDocument();
    });

    it('shows "N of N selected" when all selected', () => {
      renderWithProps([...allPermissions]);
      expect(screen.getByText(`${totalCount} of ${totalCount} selected`)).toBeInTheDocument();
    });
  });

  describe('Individual permission toggle', () => {
    it('calls onChange adding a permission when unchecked permission is clicked', () => {
      const { onChange, container } = renderWithProps([]);

      // Target the specific checkbox by its id attribute (e.g. "dashboard:view")
      const checkbox = container.querySelector('#dashboard\\:view') as HTMLElement;
      expect(checkbox).toBeTruthy();
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      // Should add the permission
      const call = onChange.mock.calls[0][0] as string[];
      expect(call).toContain('dashboard:view');
    });

    it('calls onChange removing a permission when checked permission is clicked', () => {
      const { onChange, container } = renderWithProps(['dashboard:view']);

      const checkbox = container.querySelector('#dashboard\\:view') as HTMLElement;
      expect(checkbox).toBeTruthy();
      fireEvent.click(checkbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      const call = onChange.mock.calls[0][0] as string[];
      expect(call).not.toContain('dashboard:view');
    });
  });

  describe('Select All / Deselect All', () => {
    it('Select All button selects all permissions', () => {
      const { onChange } = renderWithProps([]);

      const btn = screen.getByRole('button', { name: 'Select All' });
      fireEvent.click(btn);

      expect(onChange).toHaveBeenCalledTimes(1);
      const call = onChange.mock.calls[0][0] as string[];
      expect(call.length).toBe(totalCount);
      // Every known permission should be included
      for (const perm of allPermissions) {
        expect(call).toContain(perm);
      }
    });

    it('Deselect All button clears all permissions', () => {
      const { onChange } = renderWithProps([...allPermissions]);

      const btn = screen.getByRole('button', { name: 'Deselect All' });
      fireEvent.click(btn);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual([]);
    });

    it('Select All is disabled when all are already selected', () => {
      renderWithProps([...allPermissions]);
      const btn = screen.getByRole('button', { name: 'Select All' });
      expect(btn).toBeDisabled();
    });

    it('Deselect All is disabled when none are selected', () => {
      renderWithProps([]);
      const btn = screen.getByRole('button', { name: 'Deselect All' });
      expect(btn).toBeDisabled();
    });
  });

  describe('Module-level checkbox', () => {
    it('selects all actions in a module when module checkbox is clicked', () => {
      const { onChange } = renderWithProps([]);

      // Click the "dashboard" module checkbox
      const dashboardCheckbox = screen.getByRole('checkbox', { name: 'dashboard' });
      fireEvent.click(dashboardCheckbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      const call = onChange.mock.calls[0][0] as string[];
      // Should contain all dashboard permissions
      for (const action of PERMISSION_GROUPS[0].actions) {
        expect(call).toContain(formatPermission('dashboard', action));
      }
    });

    it('deselects all actions in a module when all are selected and module checkbox is clicked', () => {
      const dashboardPerms = PERMISSION_GROUPS[0].actions.map((a) =>
        formatPermission('dashboard', a)
      );
      const otherPerm = 'voters:read';
      const { onChange } = renderWithProps([...dashboardPerms, otherPerm]);

      const dashboardCheckbox = screen.getByRole('checkbox', { name: 'dashboard' });
      fireEvent.click(dashboardCheckbox);

      expect(onChange).toHaveBeenCalledTimes(1);
      const call = onChange.mock.calls[0][0] as string[];
      // Dashboard perms should be removed
      for (const p of dashboardPerms) {
        expect(call).not.toContain(p);
      }
      // Other perm should remain
      expect(call).toContain(otherPerm);
    });

    it('shows indeterminate state when module is partially selected', () => {
      // Select only one of dashboard's actions (dashboard has view + edit)
      renderWithProps(['dashboard:view']);

      const dashboardCheckbox = screen.getByRole('checkbox', {
        name: 'dashboard',
      });
      // Radix Checkbox sets data-state="indeterminate" for the indeterminate state
      expect(dashboardCheckbox).toHaveAttribute('data-state', 'indeterminate');
    });

    it('shows checked state when all module actions are selected', () => {
      const dashboardPerms = PERMISSION_GROUPS[0].actions.map((a) =>
        formatPermission('dashboard', a)
      );
      renderWithProps(dashboardPerms);

      const dashboardCheckbox = screen.getByRole('checkbox', {
        name: 'dashboard',
      });
      expect(dashboardCheckbox).toHaveAttribute('data-state', 'checked');
    });

    it('shows unchecked state when no module actions are selected', () => {
      renderWithProps([]);

      const dashboardCheckbox = screen.getByRole('checkbox', {
        name: 'dashboard',
      });
      expect(dashboardCheckbox).toHaveAttribute('data-state', 'unchecked');
    });
  });
});
