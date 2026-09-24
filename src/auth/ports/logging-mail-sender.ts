import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from '../../common/logging/index.js';
import type { MailSender } from './mail-sender.port.js';

/**
 * Placeholder `MailSender`: logs instead of calling SES, which isn't wired up yet (docs/11 §7.1
 * lists it as v1 infrastructure, not built in this repo yet). Swapping in a real `SesMailSender`
 * later is a provider change behind this port, not a call-site change. Never logs the address in
 * full (docs/11 §7.4: mask as `p***@gmail.com`).
 */
@Injectable()
export class LoggingMailSender implements MailSender {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingMailSender.name);
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    this.logger.warn({ to: maskEmail(to), subject }, `Mail send (no SES configured): ${text}`);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'invalid';
  return `${local[0]}***@${domain}`;
}
