import { supabase } from "../supabase.js";

const BASE_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function currentAccessToken(): Promise<string | null> {
  // supabase-js keeps the session refreshed in the background and returns it
  // from its own cache here — no network call on the common path.
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function parseErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = await res.json();
    return {
      code: body?.error?.code ?? "UNKNOWN_ERROR",
      message: body?.error?.message ?? `Request failed with status ${res.status}`,
    };
  } catch {
    return { code: "UNKNOWN_ERROR", message: `Request failed with status ${res.status}` };
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const token = skipAuth ? null : await currentAccessToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (res.status === 401 && !skipAuth) {
    // A 401 here means Supabase considers the session genuinely gone (not
    // just stale — its client already retries refresh internally before this
    // point), so there's nothing left to retry.
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.assign("/");
    throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  if (!res.ok) {
    const { code, message } = await parseErrorBody(res);
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
