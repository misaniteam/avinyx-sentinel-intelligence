"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import Image from "next/image";
import { useTheme } from "next-themes";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [mounted, setMounted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
    } catch {
      toast.error(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (user) {
      router.push(user.is_super_admin ? "/super-admin/tenants" : "/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null; // or loader\

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-md border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center">
            <Link href={"/"}>
              <Image
                src={isDark ? "/logo/logo-white.svg" : "/logo/logo-black.svg"}
                width={120}
                height={50}
                alt="Avinyx AI"
                className="mx-auto"
              />
            </Link>
          </div>
          <CardTitle className="text-2xl">{t("appTitle")}</CardTitle>
          <CardDescription>{t("signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tc("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="focus-visible:ring-0 focus-visible:outline-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tc("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-visible:ring-0 focus-visible:outline-none"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("signingIn") : t("signIn")}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="hover:text-primary">
                {t("forgotPassword")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
