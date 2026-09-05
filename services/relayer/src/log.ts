export function log(scope: string, message: string, extra?: Record<string, unknown>) {
  const line = `${new Date().toISOString()} [${scope}] ${message}`;
  if (extra) console.log(line, JSON.stringify(extra, (_, value) => (typeof value === "bigint" ? value.toString() : value)));
  else console.log(line);
}
