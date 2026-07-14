import { Resend } from "resend";
import { log } from "@/lib/logging";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export interface NotificationProvider {
  sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }>;
}

export class ResendNotificationProvider implements NotificationProvider {
  constructor(private readonly apiKey: string) {}

  async sendEmail(input: SendEmailInput) {
    const resend = new Resend(this.apiKey);
    const from = process.env.EMAIL_FROM ?? "LocalAgent <noreply@example.com>";
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  }
}

export class DryRunNotificationProvider implements NotificationProvider {
  async sendEmail(input: SendEmailInput) {
    log("info", "email_dry_run", { to: input.to, subject: input.subject });
    return { ok: true, id: `dryrun_${Date.now()}` };
  }
}

export function getNotificationProvider(): NotificationProvider {
  if (process.env.EMAIL_DRY_RUN === "true" || !process.env.RESEND_API_KEY) {
    return new DryRunNotificationProvider();
  }
  return new ResendNotificationProvider(process.env.RESEND_API_KEY);
}
