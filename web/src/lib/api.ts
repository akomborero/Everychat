import { API_URL } from "../config";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string[]>) {
    super(message);
  }
}

/**
 * The sign-in session lives in an HttpOnly cookie that the browser sends by itself, so no script on the page,
 * including ours, can read it. The X-Requested-With header proves to the server that a request came from this app.
 */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "fetch" };

  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method ?? "GET", headers, body, credentials: "include" });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 anywhere except the sign-in calls themselves means the session ended.
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError(res.status, json.error ?? "Something went wrong", json.details);
  }
  return json as T;
}

/** Downloads a JSON response as a file, for data exports. */
export async function downloadFile(path: string, filename: string) {
  let res: Response;
  try { res = await fetch(`${API_URL}${path}`, { credentials: "include", headers: { "X-Requested-With": "fetch" } }); }
  catch { throw new ApiError(0, "Can't reach the server. Check your connection and try again."); }
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ApiError(res.status, json.error ?? "The download failed");
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
