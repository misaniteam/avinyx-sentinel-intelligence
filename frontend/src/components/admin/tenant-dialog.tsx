'use client';

import { useEffect } from "react";
import { useTranslations } from "next-intl";
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

function createCreateSchema(tv: (key: string, values?: Record<string, any>) => string) {
  return z.object({
    name: z.string().min(1, tv("tenantNameRequired")),
    slug: z
      .string()
      .min(1, tv("slugRequired"))
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, tv("slugFormat")),
    constituency_code: z.string().min(1, tv("constituencyRequired")),
    admin_email: z.string().email(tv("validEmailRequired")),
    admin_password: z.string().min(8, tv("minimumChars", { min: 8 })),
    admin_name: z.string().min(1, tv("adminNameRequired")),
  });
}

function createEditSchema(tv: (key: string, values?: Record<string, any>) => string) {
  return z.object({
    name: z.string().min(1, tv("tenantNameRequired")),
    status: z.enum(["active", "inactive", "suspended"]),
  });
}

type CreateFormValues = z.infer<ReturnType<typeof createCreateSchema>>;
type EditFormValues = z.infer<ReturnType<typeof createEditSchema>>;

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
  const t = useTranslations("superAdmin.tenants");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const createSchema = createCreateSchema(tv);
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
      toast.success(t("onboardSuccess"));
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message.includes("409")
          ? t("constituencyConflict")
          : t("failedOnboard");
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("onboardTenant")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("tenantName")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{t("slug")}</Label>
            <Input id="slug" {...register("slug")} />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>{t("constituency")}</Label>
            <ConstituencyCombobox
              value={constituencyValue}
              onValueChange={(code) => setValue("constituency_code", code, { shouldValidate: true })}
            />
            {errors.constituency_code && (
              <p className="text-sm text-destructive">{errors.constituency_code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_name">{t("adminFullName")}</Label>
            <Input id="admin_name" {...register("admin_name")} />
            {errors.admin_name && (
              <p className="text-sm text-destructive">{errors.admin_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_email">{t("adminEmail")}</Label>
            <Input id="admin_email" type="email" {...register("admin_email")} />
            {errors.admin_email && (
              <p className="text-sm text-destructive">{errors.admin_email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_password">{t("adminPassword")}</Label>
            <Input id="admin_password" type="password" {...register("admin_password")} />
            {errors.admin_password && (
              <p className="text-sm text-destructive">{errors.admin_password.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              {createTenant.isPending ? tc("creating") : t("onboardTenant")}
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
  const t = useTranslations("superAdmin.tenants");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const editSchema = createEditSchema(tv);
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
      toast.success(t("updateSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(t("failedUpdate"));
    }
  };

  const constituencyName = tenant?.constituency_code
    ? WB_CONSTITUENCY_MAP.get(tenant.constituency_code)?.name
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTenant")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t("tenantName")}</Label>
            <Input id="edit-name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          {constituencyName && (
            <div className="space-y-2">
              <Label>{t("constituency")}</Label>
              <p className="text-sm text-muted-foreground">{constituencyName}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-status">{tc("status")}</Label>
            <Select value={statusValue} onValueChange={(val) => setValue("status", val as "active" | "inactive" | "suspended")}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("statusActive")}</SelectItem>
                <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
                <SelectItem value="suspended">{t("statusSuspended")}</SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={updateTenant.isPending}>
              {updateTenant.isPending ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
