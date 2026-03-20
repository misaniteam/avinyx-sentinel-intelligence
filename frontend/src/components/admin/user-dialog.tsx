'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useRoles, useCreateUser, useUpdateUser } from "@/lib/api/hooks";
import type { User } from "@/types";

const createSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "Name is required"),
  role_ids: z.array(z.string()),
});

const editSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  is_active: z.boolean(),
  role_ids: z.array(z.string()),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: User;
}

export function UserDialog({ open, onOpenChange, mode, user }: UserDialogProps) {
  const { data: roles } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const isCreate = mode === "create";

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", password: "", full_name: "", role_ids: [] },
  });

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: "", is_active: true, role_ids: [] },
  });

  useEffect(() => {
    if (open && isCreate) {
      createForm.reset({ email: "", password: "", full_name: "", role_ids: [] });
    }
    if (open && !isCreate && user) {
      editForm.reset({
        full_name: user.full_name,
        is_active: user.is_active,
        role_ids: user.roles.map((r) => r.id),
      });
    }
  }, [open, mode, user]);

  async function onSubmitCreate(data: CreateFormData) {
    try {
      await createUser.mutateAsync(data);
      toast.success("User created successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create user");
    }
  }

  async function onSubmitEdit(data: EditFormData) {
    if (!user) return;
    try {
      await updateUser.mutateAsync({ id: user.id, ...data });
      toast.success("User updated successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update user");
    }
  }

  function toggleRoleCreate(roleId: string) {
    const current = createForm.getValues("role_ids");
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    createForm.setValue("role_ids", next, { shouldDirty: true });
  }

  function toggleRoleEdit(roleId: string) {
    const current = editForm.getValues("role_ids");
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    editForm.setValue("role_ids", next, { shouldDirty: true });
  }

  const isPending = createUser.isPending || updateUser.isPending;

  const watchedCreateRoleIds = createForm.watch("role_ids");
  const watchedEditRoleIds = editForm.watch("role_ids");
  const currentRoleIds = isCreate ? watchedCreateRoleIds : watchedEditRoleIds;
  const toggleRole = isCreate ? toggleRoleCreate : toggleRoleEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add User" : "Edit User"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={
            isCreate
              ? createForm.handleSubmit(onSubmitCreate)
              : editForm.handleSubmit(onSubmitEdit)
          }
          className="space-y-4"
        >
          {isCreate && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...createForm.register("email")}
                />
                {createForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...createForm.register("password")}
                />
                {createForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.password.message}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            {isCreate ? (
              <>
                <Input id="full_name" {...createForm.register("full_name")} />
                {createForm.formState.errors.full_name && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.full_name.message}
                  </p>
                )}
              </>
            ) : (
              <>
                <Input id="full_name" {...editForm.register("full_name")} />
                {editForm.formState.errors.full_name && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.full_name.message}
                  </p>
                )}
              </>
            )}
          </div>

          {!isCreate && (
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={editForm.watch("is_active")}
                onCheckedChange={(checked) =>
                  editForm.setValue("is_active", checked, { shouldDirty: true })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-y-auto">
              {roles?.map((role) => (
                <div key={role.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={currentRoleIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <Label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer">
                    {role.name}
                  </Label>
                </div>
              ))}
              {(!roles || roles.length === 0) && (
                <p className="text-sm text-muted-foreground">No roles available</p>
              )}
            </div>
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
                  ? "Create User"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
