import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

export function getResendClient(): { client: Resend | null; from: string } {
  // Re-read dotenv in case .env was modified while server was running
  dotenv.config();
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const resendFrom = process.env.RESEND_FROM || 'TutorFlow <onboarding@resend.dev>';
  return {
    client: resendApiKey ? new Resend(resendApiKey) : null,
    from: resendFrom
  };
}

/**
 * Generates modern soft-pastel HTML email template for verification codes
 */
export function buildVerificationEmailTemplate(
  name: string, 
  code: string, 
  type: 'login' | 'register' = 'login'
): string {
  const isLogin = type === 'login';
  const badgeTitle = isLogin ? 'Login Verification' : 'Welcome to TutorFlow';
  const actionDescription = isLogin
    ? 'Someone requested to log in to your TutorFlow account using your password. Enter the code below to complete your login:'
    : 'Thank you for registering your TutorFlow learning timeline account. Please use this code to verify your email address:';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TutorFlow Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F5F9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E2E6F0; box-shadow: 0 10px 30px rgba(111, 101, 241, 0.06);" cellspacing="0" cellpadding="0">
          
          <!-- Top Gradient Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 48px; height: 48px; line-height: 48px; font-size: 24px; margin-bottom: 12px;">
                📖
              </div>
              <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.03em;">
                TutorFlow
              </h1>
              <p style="color: #E0E2FF; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">
                Home Tutor & Student Timeline Hub
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <!-- Pill Badge -->
              <div style="display: inline-block; background-color: #EEF0FD; color: #6F65F1; border: 1px solid #DCE0FA; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 20px;">
                🔐 ${badgeTitle}
              </div>

              <h2 style="font-size: 20px; font-weight: 700; color: #1D2132; margin: 0 0 12px 0;">
                Hello, ${name || 'Learner'}!
              </h2>

              <p style="font-size: 14px; color: #5C6478; line-height: 1.6; margin: 0 0 24px 0;">
                ${actionDescription}
              </p>

              <!-- 6-Digit Code Display -->
              <div style="background-color: #FAFBFD; border: 2px dashed #6F65F1; border-radius: 18px; padding: 22px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #6F65F1; display: inline-block; padding-left: 10px;">
                  ${code}
                </span>
                <div style="margin-top: 8px; font-size: 12px; color: #8F97AC; font-weight: 600;">
                  ⏱️ Expires in 10 minutes
                </div>
              </div>

              <p style="font-size: 13px; color: #8F97AC; line-height: 1.5; margin: 20px 0 0 0;">
                If you did not request this verification, please safely ignore this email. No access will be granted without entering this 6-digit code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FD; padding: 20px 30px; text-align: center; border-top: 1px solid #ECEFF6;">
              <p style="margin: 0; font-size: 12px; color: #9FA6BA;">
                © ${new Date().getFullYear()} TutorFlow. All rights reserved.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #B5BAC9;">
                Protected by JWT session authentication & Resend secure delivery
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export interface SendVerificationResult {
  success: boolean;
  messageId?: string;
  previewCode?: string;
  error?: string;
}

/**
 * Sends a 6-digit OTP code to recipient using Resend API with fallback
 */
export async function sendResendVerificationCode(
  toEmail: string,
  code: string,
  name: string,
  type: 'login' | 'register' = 'login'
): Promise<SendVerificationResult> {
  const html = buildVerificationEmailTemplate(name, code, type);
  const subject = type === 'login'
    ? `[TutorFlow] Login verification code: ${code}`
    : `[TutorFlow] Complete your registration: ${code}`;

  const { client: resend, from: resendFrom } = getResendClient();

  if (resend) {
    try {
      const response = await resend.emails.send({
        from: resendFrom,
        to: toEmail,
        subject,
        html
      });

      if (response.error) {
        console.warn('⚠️ [Resend] API Notice:', response.error.message);
        console.log(`===============================================`);
        console.log(`✉️  [Resend OTP Fallback] ${toEmail}: ${code}`);
        console.log(`ℹ️  [Resend Sandbox] Onboarding domain sends directly to your registered Resend email.`);
        console.log(`===============================================`);
        return {
          success: true,
          previewCode: code,
          error: response.error.message
        };
      }

      console.log(`===============================================`);
      console.log(`🚀 [Resend] Live email dispatched to: ${toEmail} (ID: ${response.data?.id})`);
      console.log(`🔑 Verification Code: ${code}`);
      console.log(`===============================================`);

      return {
        success: true,
        messageId: response.data?.id
      };
    } catch (err: any) {
      console.warn('⚠️ [Resend] Exception:', err.message);
    }
  }

  // Fallback for development without API key
  console.log(`===============================================`);
  console.log(`✉️  [Resend Dev Preview] Code for ${toEmail}: ${code} (${type})`);
  console.log(`===============================================`);

  return {
    success: true,
    previewCode: code
  };
}
