/**
 * Thin client for the Mailhog HTTP API.
 *
 * The password reset test reads the link out of the email that actually
 * arrived rather than mocking the mailer, so the template, the transport and
 * the token all get exercised for real.
 */

const MAILHOG_BASE_URL = process.env.MAILHOG_API_URL ?? 'http://localhost:8025';

interface MailhogMessage {
  Content?: { Body?: string; Headers?: Record<string, string[]> };
  MIME?: { Parts?: { Body?: string }[] };
}

interface MailhogList {
  total: number;
  items: MailhogMessage[];
}

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILHOG_BASE_URL}/api/v1/messages`, { method: 'DELETE' });
}

export async function listMessages(): Promise<MailhogMessage[]> {
  const response = await fetch(`${MAILHOG_BASE_URL}/api/v2/messages`);
  if (!response.ok) {
    throw new Error(
      `Mailhog ตอบกลับ ${response.status} — ยก Docker ขึ้นด้วย pnpm docker:up ก่อนรันเทสต์`,
    );
  }
  const body = (await response.json()) as MailhogList;
  return body.items;
}

/** Waits for one message to land; Mailhog receives it a moment after the API responds. */
export async function waitForMessage(timeoutMs = 5000): Promise<MailhogMessage> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const messages = await listMessages();
    if (messages.length > 0) {
      return messages[0];
    }
    if (Date.now() > deadline) {
      throw new Error('ไม่มีอีเมลเข้า Mailhog ภายในเวลาที่กำหนด');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Concatenates every part of the message and undoes quoted-printable encoding. */
export function messageBody(message: MailhogMessage): string {
  const parts = [
    message.Content?.Body ?? '',
    ...(message.MIME?.Parts ?? []).map((p) => p.Body ?? ''),
  ];
  return parts.map(decodeQuotedPrintable).join('\n');
}

export function extractResetToken(message: MailhogMessage): string {
  const match = /reset-password\?token=([a-f0-9]{64})/.exec(messageBody(message));
  if (!match) {
    throw new Error('ไม่พบลิงก์ตั้งรหัสผ่านใหม่ในอีเมลที่ส่งออก');
  }
  return match[1];
}

/**
 * Undoes quoted-printable: soft line breaks would otherwise split the reset
 * token in half, and each Thai character arrives as three separate "=XX"
 * bytes that only mean something once decoded as UTF-8 together.
 */
function decodeQuotedPrintable(input: string): string {
  const unfolded = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];

  for (let index = 0; index < unfolded.length; index += 1) {
    const isEscape =
      unfolded[index] === '=' && /^[0-9A-Fa-f]{2}$/.test(unfolded.slice(index + 1, index + 3));

    if (isEscape) {
      bytes.push(parseInt(unfolded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(unfolded.charCodeAt(index) & 0xff);
    }
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}
