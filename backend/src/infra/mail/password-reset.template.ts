/**
 * Password reset email, Thai copy on the getownly palette.
 *
 * Email clients strip <style> blocks and ignore most modern CSS, so this one
 * template hardcodes the hex values from CLAUDE.md inline. That is the single
 * exception to "never hardcode a colour": there is no token pipeline inside an
 * inbox. Everything here mirrors the design tokens exactly.
 */

const PRIMARY = '#1E3A5C';
const SECONDARY = '#C9A063';
const FOREGROUND = '#111827';
const MUTED = '#6B7280';
const SUBTLE = '#9CA3AF';
const BORDER = '#E5E7EB';
const BACKGROUND = '#F8F9FA';
const CARD = '#FFFFFF';

export interface PasswordResetEmailInput {
  displayName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetSubject(): string {
  return 'ตั้งรหัสผ่านใหม่สำหรับบัญชี getownly';
}

export function passwordResetText({
  displayName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailInput): string {
  return [
    `สวัสดีคุณ ${displayName}`,
    '',
    'เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี getownly ของคุณ',
    'เปิดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่',
    '',
    resetUrl,
    '',
    `ลิงก์นี้ใช้ได้ภายใน ${expiresInMinutes} นาที และใช้ได้เพียงครั้งเดียว`,
    'ถ้าคุณไม่ได้เป็นผู้ขอ ไม่ต้องดำเนินการใดๆ รหัสผ่านเดิมของคุณยังใช้งานได้ตามปกติ',
    '',
    'ทีมงาน getownly',
  ].join('\n');
}

export function passwordResetHtml({
  displayName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailInput): string {
  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ตั้งรหัสผ่านใหม่</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BACKGROUND};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:${BACKGROUND};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:560px;background-color:${CARD};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">

            <tr>
              <td style="background-color:${PRIMARY};padding:24px 32px;">
                <div style="font-family:'IBM Plex Sans Thai','Segoe UI',Tahoma,sans-serif;
                            font-size:20px;font-weight:600;color:#FFFFFF;letter-spacing:0.5px;">
                  getownly
                </div>
                <div style="font-family:'IBM Plex Sans Thai','Segoe UI',Tahoma,sans-serif;
                            font-size:13px;color:${SECONDARY};padding-top:4px;">
                  ตลาดกลางคอร์สเรียนออนไลน์
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;font-family:'IBM Plex Sans Thai','Segoe UI',Tahoma,sans-serif;">
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:${FOREGROUND};">
                  ตั้งรหัสผ่านใหม่
                </h1>

                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:${FOREGROUND};">
                  สวัสดีคุณ ${escapeHtml(displayName)}
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${MUTED};">
                  เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ
                  กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ได้ทันที
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background-color:${PRIMARY};border-radius:8px;">
                      <a href="${resetUrl}"
                         style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;
                                color:#FFFFFF;text-decoration:none;
                                font-family:'IBM Plex Sans Thai','Segoe UI',Tahoma,sans-serif;">
                        ตั้งรหัสผ่านใหม่
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="border:1px solid ${BORDER};border-radius:8px;padding:12px 16px;margin:0 0 24px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
                    ลิงก์นี้ใช้ได้ภายใน <strong style="color:${FOREGROUND};">${expiresInMinutes} นาที</strong>
                    และใช้ได้เพียงครั้งเดียวเท่านั้น
                  </p>
                </div>

                <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:${MUTED};">
                  ถ้าปุ่มด้านบนกดไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์
                </p>
                <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:${SUBTLE};word-break:break-all;">
                  ${resetUrl}
                </p>

                <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 16px;" />

                <p style="margin:0;font-size:13px;line-height:1.7;color:${MUTED};">
                  ถ้าคุณไม่ได้เป็นผู้ขอตั้งรหัสผ่านใหม่ ไม่ต้องดำเนินการใดๆ
                  รหัสผ่านเดิมของคุณยังใช้งานได้ตามปกติ
                </p>
              </td>
            </tr>

            <tr>
              <td style="background-color:${BACKGROUND};border-top:1px solid ${BORDER};padding:16px 32px;">
                <p style="margin:0;font-size:12px;color:${SUBTLE};
                          font-family:'IBM Plex Sans Thai','Segoe UI',Tahoma,sans-serif;">
                  อีเมลฉบับนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The display name comes from user input, so it never goes into the markup raw. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
