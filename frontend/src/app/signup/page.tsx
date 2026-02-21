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

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const tokens = await apiRequest<AuthTokens>("/api/auth/register", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      const me = await apiRequest<Me>("/api/auth/me");
      setCachedMe(me);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-bg-main via-[#12243f] to-[#0b152a] p-4">
      <ThemeToggle className="fixed right-4 top-4 z-10" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-bold">Create Account</h1>
          <p className="mt-1 text-sm text-textsub">Create a new intranet account.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-textsub">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
