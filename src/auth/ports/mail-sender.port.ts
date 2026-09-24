/** Narrow port over outbound mail (docs/11 §2.3, §7.1: SES in production). One capability. */
export interface MailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');
