import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth-storage";
import type { AuthTokens } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface RequestOptions extends RequestInit {
  auth?: boolean;
  retry?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const tokens = (await response.json()) as AuthTokens;
  setTokens(tokens.access_token, tokens.refresh_token);
  return tokens.access_token;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, retry = true, headers, body, ...rest } = options;

  const requestHeaders = new Headers(headers ?? {});
  if (!(body instanceof FormData) && body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: requestHeaders,
    body
  });

  if (response.status === 401 && auth && retry) {
    const renewedToken = await refreshAccessToken();
    if (renewedToken) {
      return apiRequest<T>(path, {
        ...options,
        retry: false,
        headers: {
          ...(headers ?? {}),
          Authorization: `Bearer ${renewedToken}`
        }
      });
    }
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? JSON.stringify(errorBody);
    } catch {
      // no-op
    }
    throw new Error(detail || "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (!response.ok) {
    throw new Error("Download failed");
  }
  return response.blob();
}
