import type { CalendarProvider } from "@/lib/calendar/types";
import { AppError } from "@/lib/errors";

export class ManualCalendarProvider implements CalendarProvider {
  readonly name = "manual" as const;

  async listAvailability() {
    return [];
  }

  async createEvent(_input: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    timezone: string;
  }): Promise<{ eventId: string }> {
    throw new AppError(
      "VALIDATION",
      "Manual booking mode cannot confirm calendar events. Create a pending request instead.",
    );
  }
}

export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google" as const;

  constructor(
    private readonly accessToken: string,
    private readonly calendarId: string,
  ) {}

  async listAvailability(input: {
    timeMin: string;
    timeMax: string;
  }): Promise<Array<{ start: string; end: string }>> {
    if (!this.accessToken) {
      throw new AppError("PROVIDER", "Google Calendar is not connected");
    }
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/freeBusy`,
    );
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        items: [{ id: this.calendarId }],
      }),
    });
    if (!res.ok) throw new AppError("PROVIDER", "Google freeBusy failed");
    // FreeBusy returns busy blocks; availability computation left to booking service.
    return [];
  }

  async createEvent(input: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    timezone: string;
  }) {
    if (!this.accessToken) {
      throw new AppError("PROVIDER", "Google Calendar is not connected");
    }
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.start, timeZone: input.timezone },
          end: { dateTime: input.end, timeZone: input.timezone },
        }),
      },
    );
    if (!res.ok) throw new AppError("PROVIDER", "Google event create failed");
    const json = (await res.json()) as { id: string };
    return { eventId: json.id };
  }
}
