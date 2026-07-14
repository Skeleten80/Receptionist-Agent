export type CalendarProviderName = "google" | "manual";

export interface CalendarProvider {
  readonly name: CalendarProviderName;
  listAvailability(input: {
    timeMin: string;
    timeMax: string;
  }): Promise<Array<{ start: string; end: string }>>;
  createEvent(input: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    timezone: string;
  }): Promise<{ eventId: string }>;
}
