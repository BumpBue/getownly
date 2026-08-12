import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import generatePayload from 'promptpay-qr';
import { toDataURL } from 'qrcode';
import { envFlag } from '@/config/env.validation';
import type { TopupQuoteDto } from './dto/topup-response.dto';
import { QrGenerationFailedException } from './topups.errors';

/**
 * Builds the PromptPay QR a student scans in their banking app.
 *
 * Nothing here is a payment: no bank is contacted, no transfer is confirmed and
 * nothing is written down. The QR just pre-fills a manual transfer, and the
 * only evidence the platform ever sees is the slip an admin looks at
 * afterwards (CLAUDE.md, ข้อ 1.3).
 */
@Injectable()
export class PromptPayService {
  private readonly logger = new Logger(PromptPayService.name);

  private readonly promptpayId: string;
  private readonly displayName: string;
  private readonly demoMode: boolean;
  private readonly quoteExpiryMinutes: number;

  constructor(private readonly config: ConfigService) {
    this.promptpayId = this.config.getOrThrow<string>('PROMPTPAY_ID');
    this.displayName = this.config.getOrThrow<string>('PROMPTPAY_DISPLAY_NAME');
    this.demoMode = envFlag(this.config.get<string>('DEMO_MODE'));
    this.quoteExpiryMinutes = Number(
      this.config.getOrThrow<string | number>('TOPUP_QUOTE_EXPIRY_MINUTES'),
    );

    if (!this.demoMode) {
      this.logger.warn(
        'DEMO_MODE=false: QR ที่ระบบสร้างจะชี้ไปยังบัญชี PromptPay จริงตามค่าใน .env',
      );
    }
  }

  get isDemoMode(): boolean {
    return this.demoMode;
  }

  /** Generates the payload and its PNG for one amount. */
  async buildQuote(amount: Prisma.Decimal): Promise<TopupQuoteDto> {
    const payload = this.buildPayload(amount);

    let qrDataUrl: string;
    try {
      qrDataUrl = await toDataURL(payload, {
        errorCorrectionLevel: 'M',
        // Big enough to stay scannable from a phone photographing a screen,
        // and to survive being saved and re-opened in a banking app.
        width: 512,
        margin: 2,
      });
    } catch (error) {
      this.logger.error(
        'สร้างภาพ QR ไม่สำเร็จ',
        error instanceof Error ? error.stack : String(error),
      );
      throw new QrGenerationFailedException();
    }

    return {
      amount: amount.toFixed(2),
      payload,
      qrDataUrl,
      expiresAt: new Date(Date.now() + this.quoteExpiryMinutes * 60_000).toISOString(),
      promptpayId: this.promptpayId,
      promptpayName: this.displayName,
      isDemoMode: this.demoMode,
    };
  }

  /**
   * The one place in the system where an amount becomes a JS number.
   *
   * `promptpay-qr` takes a number and formats it with `toFixed(2)` to build the
   * EMVCo field. It is safe precisely because it goes nowhere else: the value
   * written down, charged and posted to the ledger is always the Decimal, and
   * this copy only ever ends up as pixels in a QR image. Amounts are capped by
   * TOPUP_MAX_AMOUNT, far inside the range a double represents exactly to two
   * decimal places.
   */
  private buildPayload(amount: Prisma.Decimal): string {
    return generatePayload(this.promptpayId, { amount: Number(amount.toFixed(2)) });
  }
}
