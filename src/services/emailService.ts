import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    console.log(`📧 [Nodemailer] Configured SMTP server: ${host}:${port} (${user})`);
  } else {
    // Development fallback transporter: uses JSON transport or console logger
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
    console.log('ℹ️  [Nodemailer] Live SMTP credentials not set in .env. Verification codes will also be displayed in server logs for testing.');
  }

  return transporter;
}

/**
 * Sends a 6-digit verification code to the recipient email
 */
export async function sendVerificationCodeEmail(toEmail: string, code: string, name: string): Promise<{ success: boolean; previewCode?: string }> {
  const mailer = getTransporter();
  const fromAddress = process.env.SMTP_FROM || '"TutorFlow Verification" <noreply@tutorflow.com>';

  const htmlContent = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #ECEFF6; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04);">
      <div style="background: linear-gradient(135deg, #7A70FF 0%, #685DF0 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">TutorFlow</h1>
        <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Verify Your Email Address</p>
      </div>
      <div style="padding: 32px 28px; color: #1D2132;">
        <h2 style="font-size: 18px; margin-top: 0; color: #1D2132;">Hello ${name || 'Student'},</h2>
        <p style="font-size: 14px; color: #747C92; line-height: 1.6;">
          Thank you for registering with <strong>TutorFlow</strong>. Please use the following 6-digit verification code to activate your account.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #6F65F1; background: #EEF0FD; padding: 14px 28px; border-radius: 14px; border: 1.5px solid #DCE0FA;">
            ${code}
          </span>
        </div>
        <p style="font-size: 13px; color: #9FA6BA; line-height: 1.5; margin-bottom: 0;">
          This code is valid for <strong>10 minutes</strong>. If you did not request this registration, please disregard this email.
        </p>
      </div>
      <div style="background: #F8F9FD; padding: 16px; text-align: center; font-size: 12px; color: #9FA6BA; border-top: 1px solid #ECEFF6;">
        © ${new Date().getFullYear()} TutorFlow Timeline Hub. All rights reserved.
      </div>
    </div>
  `;

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `[TutorFlow] Your verification code is ${code}`,
      text: `Your TutorFlow verification code is: ${code}. It expires in 10 minutes.`,
      html: htmlContent
    });

    console.log(`===============================================`);
    console.log(`✉️  [Email Verification] Code sent to: ${toEmail}`);
    console.log(`🔑 Verification Code: ${code}`);
    console.log(`===============================================`);

    return {
      success: true,
      previewCode: (!process.env.SMTP_HOST || !process.env.SMTP_USER) ? code : undefined
    };
  } catch (err: any) {
    console.error('⚠️ [Nodemailer] Send mail failed:', err.message);
    // Still log code in console so developer can register even if SMTP network error occurs
    console.log(`===============================================`);
    console.log(`⚠️  Fallback Verification Code for ${toEmail}: ${code}`);
    console.log(`===============================================`);
    return {
      success: true,
      previewCode: code
    };
  }
}
