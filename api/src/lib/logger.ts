/** One JSON object per line, so hosting dashboards can search and filter the logs. */
export function logError(msg: string, err?: unknown, ctx: Record<string, unknown> = {}) {
  const error = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 6).join("\n") } : err;
  console.error(JSON.stringify({ level: "error", time: new Date().toISOString(), msg, error, ...ctx }));
}
export function logInfo(msg: string, ctx: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), msg, ...ctx }));
}
