import { useCallback, useEffect, useState } from "react";
import { BRAND_NAME } from "../config";
import { api, errorMessage } from "./api";
import { isLive, onLive } from "./live";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/** Fetches `path`, optionally re-fetching every `poll` ms while the tab is visible. Pass null to skip. */
/** `live: true` reloads instantly when the server announces a change. The poll timer then only acts as a safety net. */
export function useApi<T>(path: string | null, opts: { poll?: number; live?: boolean } = {}): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);

  const load = useCallback(
    async (silent: boolean) => {
      if (!path) return;
      if (!silent) { setLoading(true); setData(null); }
      try {
        setData(await api<T>(path));
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load(false);
    if (!path) return;

    let ticks = 0;
    const id = opts.poll
      ? setInterval(() => {
          if (document.hidden) return;
          ticks++;
          if (opts.live && isLive() && ticks % 6 !== 0) return; // live connection is up: only the occasional safety refresh
          void load(true);
        }, opts.poll)
      : undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = opts.live ? onLive(() => { clearTimeout(timer); timer = setTimeout(() => { if (!document.hidden) void load(true); }, 200); }) : undefined;
    // Events are missed while the tab is hidden, so catch up as soon as it is visible again.
    const onVisible = () => { if (!document.hidden) void load(true); };
    if (opts.live) document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (id) clearInterval(id);
      clearTimeout(timer);
      off?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, opts.poll, opts.live, path]);

  return { data, error, loading, reload: () => load(true) };
}

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${BRAND_NAME}`;
    return () => { document.title = previous; };
  }, [title]);
}
