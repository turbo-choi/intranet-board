"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAccessToken, setTokens } from "@/lib/auth-storage";
import { apiRequest } from "@/lib/api-client";
import { setCachedMe } from "@/lib/me-cache";
import type { AuthTokens, Me } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await apiRequest<AuthTokens>("/api/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const me = await apiRequest<Me>("/api/auth/me");
      setCachedMe(me);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-bg-main via-[#12243f] to-[#0b152a] p-4">
      <ThemeToggle className="fixed right-4 top-4 z-10" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-bold">Corporate Board Login</h1>
          <p className="mt-1 text-sm text-textsub">Sign in with your intranet account.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 rounded-lg border border-border bg-bg-main p-3 text-xs text-textsub">
            Seed account: <span className="font-semibold">admin / admin1234</span>
          </div>
          <p className="mt-4 text-sm text-textsub">
            Need an account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
