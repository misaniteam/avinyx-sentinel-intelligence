'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PERMISSION_GROUPS, formatPermission } from "@/lib/rbac/permissions";

interface PermissionSelectProps {
  value: string[];
  onChange: (permissions: string[]) => void;
}

export function PermissionSelect({ value, onChange }: PermissionSelectProps) {
  function toggle(permission: string) {
    if (value.includes(permission)) {
      onChange(value.filter((p) => p !== permission));
    } else {
      onChange([...value, permission]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {PERMISSION_GROUPS.map((group) => (
          <div
            key={group.resource}
            className="flex items-center gap-4 rounded-md border p-3"
          >
            <span className="w-28 text-sm font-medium capitalize">
              {group.resource.replace("_", " ")}
            </span>
            <div className="flex flex-wrap gap-4">
              {group.actions.map((action) => {
                const perm = formatPermission(group.resource, action);
                return (
                  <div key={perm} className="flex items-center gap-1.5">
                    <Checkbox
                      id={perm}
                      checked={value.includes(perm)}
                      onCheckedChange={() => toggle(perm)}
                    />
                    <Label htmlFor={perm} className="text-sm cursor-pointer">
                      {action}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
