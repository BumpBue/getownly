import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { envFlag } from '@/config/env.validation';
import {
  passwordResetHtml,
  passwordResetSubject,
  passwordResetText,
  type PasswordResetEmailInput,
} from './password-reset.template';

/**
 * Sends transactional email. In development every message lands in Mailhog
 * (http://localhost:8025) rather than a real inbox.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('MAIL_USER');
    const pass = this.config.get<string>('MAIL_PASSWORD');

    this.transporter = createTransport({
      host: this.config.getOrThrow<string>('MAIL_HOST'),
      port: Number(this.config.getOrThrow<string>('MAIL_PORT')),
      secure: envFlag(this.config.get<string>('MAIL_SECURE')),
      // Mailhog accepts anything, so credentials stay off unless configured.
      ...(user ? { auth: { user, pass: pass ?? '' } } : {}),
    });

    this.from = `"${this.config.getOrThrow<string>('MAIL_FROM_NAME')}" <${this.config.getOrThrow<string>('MAIL_FROM_ADDRESS')}>`;
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }

  async sendPasswordReset(to: string, input: PasswordResetEmailInput): Promise<void> {
    await this.send({
      to,
      subject: passwordResetSubject(),
      text: passwordResetText(input),
      html: passwordResetHtml(input),
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
    } catch (error) {
      // A dead mail server must not turn into a failed request for the user:
      // forgot-password answers the same way whatever happens. It is logged
      // loudly instead so the problem is still visible.
      this.logger.error(
        `ส่งอีเมลไปยัง ${message.to} ไม่สำเร็จ (${message.subject})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
