"use client";

import { useRoles } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AdminRolesPage() {
  const { data: roles, isLoading } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Roles</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> Create Role</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle className="text-lg">{role.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">{role.description || "No description"}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((p) => (
                  <span key={p} className="rounded-full bg-muted px-2 py-1 text-xs">{p}</span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="text-xs text-muted-foreground">+{role.permissions.length - 5} more</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
