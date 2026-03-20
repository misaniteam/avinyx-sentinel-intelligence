"use client";

import { useTenants } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SuperAdminTenantsPage() {
  const { data: tenants, isLoading } = useTenants();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> Onboard Tenant</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Slug</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants?.map((tenant) => (
                <tr key={tenant.id} className="border-b">
                  <td className="p-3 font-medium">{tenant.name}</td>
                  <td className="p-3">{tenant.slug}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${
                      tenant.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>{tenant.status}</span>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(tenant.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!tenants || tenants.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No tenants yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
