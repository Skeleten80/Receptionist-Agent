type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "api_key",
  "apikey",
  "refresh_token",
  "access_token",
  "stripe",
  "credential",
];

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? (redact(meta) as object) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
