'use client';

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PERMISSION_GROUPS, formatPermission, getAllPermissions } from "@/lib/rbac/permissions";

interface PermissionSelectProps {
  value: string[];
  onChange: (permissions: string[]) => void;
}

export function PermissionSelect({ value, onChange }: PermissionSelectProps) {
  const allPermissions = useMemo(() => getAllPermissions(), []);
  const totalCount = allPermissions.length;
  const selectedCount = value.length;

  function toggle(permission: string) {
    if (value.includes(permission)) {
      onChange(value.filter((p) => p !== permission));
    } else {
      onChange([...value, permission]);
    }
  }

  function toggleModule(resource: string, actions: readonly string[]) {
    const modulePerms = actions.map((a) => formatPermission(resource, a));
    const allSelected = modulePerms.every((p) => value.includes(p));
    if (allSelected) {
      onChange(value.filter((p) => !modulePerms.includes(p)));
    } else {
      const newPerms = new Set([...value, ...modulePerms]);
      onChange(Array.from(newPerms));
    }
  }

  function selectAll() {
    onChange([...allPermissions]);
  }

  function deselectAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {selectedCount} of {totalCount} selected
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={selectedCount === totalCount}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAll}
            disabled={selectedCount === 0}
          >
            Deselect All
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {PERMISSION_GROUPS.map((group) => {
          const modulePerms = group.actions.map((a) =>
            formatPermission(group.resource, a)
          );
          const allModuleSelected = modulePerms.every((p) =>
            value.includes(p)
          );
          const someModuleSelected =
            !allModuleSelected &&
            modulePerms.some((p) => value.includes(p));

          return (
            <div
              key={group.resource}
              className="rounded-md border overflow-hidden"
            >
              <div className="flex items-center gap-3 bg-muted/50 px-3 py-2">
                <Checkbox
                  id={`module-${group.resource}`}
                  checked={
                    allModuleSelected
                      ? true
                      : someModuleSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={() =>
                    toggleModule(group.resource, group.actions)
                  }
                />
                <Label
                  htmlFor={`module-${group.resource}`}
                  className="text-sm font-medium capitalize cursor-pointer"
                >
                  {group.resource.replaceAll("_", " ")}
                </Label>
              </div>
              <div className="flex flex-wrap gap-4 px-3 py-2 pl-9">
                {group.actions.map((action) => {
                  const perm = formatPermission(group.resource, action);
                  return (
                    <div key={perm} className="flex items-center gap-1.5">
                      <Checkbox
                        id={perm}
                        checked={value.includes(perm)}
                        onCheckedChange={() => toggle(perm)}
                      />
                      <Label
                        htmlFor={perm}
                        className="text-sm cursor-pointer"
                      >
                        {action}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
