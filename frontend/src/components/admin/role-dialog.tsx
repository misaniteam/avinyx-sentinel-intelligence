'use client';

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionSelect } from "@/components/admin/permission-select";
import { useCreateRole, useUpdateRole } from "@/lib/api/hooks";
import type { Role } from "@/types";

const roleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  role?: Role;
}

export function RoleDialog({ open, onOpenChange, mode, role }: RoleDialogProps) {
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const isCreate = mode === "create";

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", description: "", permissions: [] },
  });

  useEffect(() => {
    if (open && isCreate) {
      form.reset({ name: "", description: "", permissions: [] });
    }
    if (open && !isCreate && role) {
      form.reset({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions,
      });
    }
  }, [open, mode, role]);

  async function onSubmit(data: RoleFormData) {
    try {
      if (isCreate) {
        await createRole.mutateAsync({
          name: data.name,
          description: data.description,
          permissions: data.permissions,
        });
        toast.success("Role created successfully");
      } else if (role) {
        await updateRole.mutateAsync({
          id: role.id,
          name: data.name,
          description: data.description,
          permissions: data.permissions,
        });
        toast.success("Role updated successfully");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      const detail = (error as { response?: { status?: number } })?.response?.status;
      if (detail === 409) {
        toast.error("A role with this name already exists");
      } else {
        toast.error(isCreate ? "Failed to create role" : "Failed to update role");
      }
    }
  }

  const isPending = createRole.isPending || updateRole.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create Role" : "Edit Role"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a new role with specific permissions for your team."
              : "Update the role name, description, or permissions."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <PermissionSelect
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {form.formState.errors.permissions && (
              <p className="text-sm text-destructive">
                {form.formState.errors.permissions.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isCreate
                  ? "Creating..."
                  : "Saving..."
                : isCreate
                  ? "Create Role"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
