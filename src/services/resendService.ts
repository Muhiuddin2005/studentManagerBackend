import { sendVerificationCodeEmail, buildVerificationEmailTemplate, SendEmailResult } from './emailService.js';

export { buildVerificationEmailTemplate };
export type SendVerificationResult = SendEmailResult;

/**
 * Compatibility wrapper: redirects to Nodemailer emailService
 */
export async function sendResendVerificationCode(
  toEmail: string,
  code: string,
  name: string,
  type: 'login' | 'register' = 'login'
): Promise<SendEmailResult> {
  return sendVerificationCodeEmail(toEmail, code, name, type);
}
