'use client';

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTenant, useUpdateTenant } from "@/lib/api/hooks";
import { toast } from "sonner";
import { ConstituencyCombobox } from "@/components/admin/constituency-combobox";
import { WB_CONSTITUENCY_MAP } from "@/lib/data/wb-constituencies";
import type { Tenant } from "@/types";

const createSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase alphanumeric and hyphens only"),
  constituency_code: z.string().min(1, "Constituency is required"),
  admin_email: z.string().email("Valid email required"),
  admin_password: z.string().min(8, "Minimum 8 characters"),
  admin_name: z.string().min(1, "Admin name is required"),
});

const editSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  status: z.enum(["active", "inactive", "suspended"]),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

interface TenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  tenant?: Tenant;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TenantDialog({ open, onOpenChange, mode, tenant }: TenantDialogProps) {
  if (mode === "create") {
    return <CreateTenantForm open={open} onOpenChange={onOpenChange} />;
  }
  return <EditTenantForm open={open} onOpenChange={onOpenChange} tenant={tenant} />;
}

function CreateTenantForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createTenant = useCreateTenant();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      slug: "",
      constituency_code: "",
      admin_email: "",
      admin_password: "",
      admin_name: "",
    },
  });

  const nameValue = watch("name");
  const constituencyValue = watch("constituency_code");

  useEffect(() => {
    setValue("slug", slugify(nameValue));
  }, [nameValue, setValue]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (values: CreateFormValues) => {
    try {
      await createTenant.mutateAsync({
        tenant: {
          name: values.name,
          slug: values.slug,
          constituency_code: values.constituency_code,
        },
        admin_email: values.admin_email,
        admin_password: values.admin_password,
        admin_name: values.admin_name,
      });
      toast.success("Tenant onboarded successfully");
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes("409")
          ? "Constituency is already assigned to another tenant"
          : "Failed to onboard tenant";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tenant Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register("slug")} />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Constituency</Label>
            <ConstituencyCombobox
              value={constituencyValue}
              onValueChange={(code) => setValue("constituency_code", code, { shouldValidate: true })}
            />
            {errors.constituency_code && (
              <p className="text-sm text-destructive">{errors.constituency_code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_name">Admin Full Name</Label>
            <Input id="admin_name" {...register("admin_name")} />
            {errors.admin_name && (
              <p className="text-sm text-destructive">{errors.admin_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_email">Admin Email</Label>
            <Input id="admin_email" type="email" {...register("admin_email")} />
            {errors.admin_email && (
              <p className="text-sm text-destructive">{errors.admin_email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_password">Admin Password</Label>
            <Input id="admin_password" type="password" {...register("admin_password")} />
            {errors.admin_password && (
              <p className="text-sm text-destructive">{errors.admin_password.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              {createTenant.isPending ? "Creating..." : "Onboard Tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTenantForm({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: Tenant;
}) {
  const updateTenant = useUpdateTenant();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", status: "active" },
  });

  const statusValue = watch("status");

  useEffect(() => {
    if (tenant && open) {
      reset({
        name: tenant.name,
        status: (tenant.status as "active" | "inactive" | "suspended") || "active",
      });
    }
  }, [tenant, open, reset]);

  const onSubmit = async (values: EditFormValues) => {
    if (!tenant) return;
    try {
      await updateTenant.mutateAsync({ id: tenant.id, name: values.name, status: values.status });
      toast.success("Tenant updated successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update tenant");
    }
  };

  const constituencyName = tenant?.constituency_code
    ? WB_CONSTITUENCY_MAP.get(tenant.constituency_code)?.name
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tenant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Tenant Name</Label>
            <Input id="edit-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          {constituencyName && (
            <div className="space-y-2">
              <Label>Constituency</Label>
              <p className="text-sm text-muted-foreground">{constituencyName}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={statusValue} onValueChange={(val) => setValue("status", val as "active" | "inactive" | "suspended")}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTenant.isPending}>
              {updateTenant.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
