"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUsers, useDeleteUser } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UserDialog } from "@/components/admin/user-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import type { User } from "@/types";

export default function AdminUsersPage() {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const { data: users, isLoading } = useUsers();
  const deleteUser = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | undefined>();

  function handleAdd() {
    setDialogMode("create");
    setSelectedUser(undefined);
    setDialogOpen(true);
  }

  function handleEdit(user: User) {
    setDialogMode("edit");
    setSelectedUser(user);
    setDialogOpen(true);
  }

  function handleDeleteClick(user: User) {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;
    try {
      await deleteUser.mutateAsync(userToDelete.id);
      toast.success(t("userDeleted"));
      setDeleteDialogOpen(false);
      setUserToDelete(undefined);
    } catch {
      toast.error(t("failedDelete"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button onClick={handleAdd}>
          <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("addUser")}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">{tc("name")}</th>
                <th className="p-3 text-left font-medium">{tc("email")}</th>
                <th className="p-3 text-left font-medium">{t("roles")}</th>
                <th className="p-3 text-left font-medium">{tc("status")}</th>
                <th className="p-3 text-right font-medium">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-3">{user.full_name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3">
                    {user.roles.map((r) => r.name).join(", ") || "\u2014"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        user.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.is_active ? tc("active") : tc("inactive")}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(user)} className="cursor-pointer group">
                          <Pencil className="mr-1 h-4 w-4 text-theme-primary group-hover:text-primary" />
                          {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(user)}
                          className="cursor-pointer group"
                        >
                          <Trash2 className="mr-1 h-4 w-4 text-theme-primary group-hover:text-primary" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {(!users || users.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {t("noUsersFound")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        user={selectedUser}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteUser")}
        description={t("deleteUserConfirm", { name: userToDelete?.full_name ?? "" })}
        onConfirm={handleDeleteConfirm}
        isPending={deleteUser.isPending}
      />
    </div>
  );
}
