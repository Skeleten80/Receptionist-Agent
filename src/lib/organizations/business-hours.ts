const DAY_MS = 86_400_000;

export type HoursRule = {
  day_of_week: number; // 0=Monday .. 6=Sunday (matches product schema)
  is_open: boolean;
  open_time?: string | null; // HH:MM
  close_time?: string | null;
};

function parseHm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** Convert JS Date.getDay() (0=Sun) to schema day (0=Mon). */
export function toSchemaDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function isOpenAt(rules: HoursRule[], at: Date): boolean {
  const day = toSchemaDay(at.getDay());
  const rule = rules.find((r) => r.day_of_week === day);
  if (!rule || !rule.is_open || !rule.open_time || !rule.close_time) return false;
  const minutes = at.getHours() * 60 + at.getMinutes();
  return minutes >= parseHm(rule.open_time) && minutes < parseHm(rule.close_time);
}

export function nextOpenSlot(rules: HoursRule[], from: Date): Date | null {
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(from.getTime() + i * DAY_MS);
    const day = toSchemaDay(candidate.getDay());
    const rule = rules.find((r) => r.day_of_week === day);
    if (!rule?.is_open || !rule.open_time) continue;
    const [h, m] = rule.open_time.split(":").map(Number);
    const open = new Date(candidate);
    open.setHours(h, m, 0, 0);
    if (open >= from) return open;
  }
  return null;
}
