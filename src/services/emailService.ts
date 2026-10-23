import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { RoutineItem, DayOfWeek } from '../types/index.js';

dotenv.config();

let transporter: Transporter | null = null;

export function getTransporter(): Transporter {
  // Always refresh dotenv in case credentials were updated in runtime
  dotenv.config();

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      }
    });
    return transporter;
  }

  // Fallback if credentials not set: JSON transport
  transporter = nodemailer.createTransport({
    jsonTransport: true
  });
  console.warn('⚠️  [Nodemailer] SMTP_USER or SMTP_PASS not set in environment. Emails will not be dispatched.');
  return transporter;
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
                Protected by JWT session authentication & secure email delivery
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

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a 6-digit verification code to the recipient email using Nodemailer SMTP
 */
export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string,
  name: string,
  type: 'login' | 'register' = 'login'
): Promise<SendEmailResult> {
  const mailer = getTransporter();
  const user = process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (user ? `"TutorFlow" <${user}>` : '"TutorFlow" <noreply@tutorflow.com>');

  const subject = type === 'login'
    ? `[TutorFlow] Login verification code: ${code}`
    : `[TutorFlow] Complete your registration: ${code}`;

  const html = buildVerificationEmailTemplate(name, code, type);
  const text = `Your TutorFlow verification code is: ${code}. It expires in 10 minutes.`;

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text,
      html
    });

    console.log(`===============================================`);
    console.log(`✉️  [Nodemailer] Live email dispatched to: ${toEmail} (ID: ${info.messageId})`);
    console.log(`===============================================`);

    return {
      success: true,
      messageId: info.messageId
    };
  } catch (err: any) {
    console.error(`⚠️  [Nodemailer Error] Failed to send email to ${toEmail}:`, err.message);
    throw new Error(`Failed to deliver verification email: ${err.message}`);
  }
}

export type TaskChangeEvent = 
  | 'task_created' 
  | 'status_updated' 
  | 'attachment_added' 
  | 'comment_added' 
  | 'task_deleted';

export interface TaskChangeNotificationPayload {
  event: TaskChangeEvent;
  taskTitle: string;
  subject?: string;
  priority?: string;
  actorName: string;
  actorRole: 'student' | 'tutor';
  oldStatus?: string;
  newStatus?: string;
  details?: string;
  imageUrl?: string | null;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  tutorId?: string;
  tutorName?: string;
  tutorEmail?: string;
  tupleId?: string | null;
}

/**
 * Resolves the recipient email based on who took action:
 * - If STUDENT took action -> Notification is sent to the TEACHER / TUTOR ONLY.
 * - If TUTOR took action -> Notification is sent to the STUDENT ONLY.
 */
export async function getTargetRecipientEmails(payload: TaskChangeNotificationPayload): Promise<string[]> {
  const targetRole = payload.actorRole === 'student' ? 'tutor' : 'student';
  const recipients = new Set<string>();

  // 1. Direct email provided in payload
  if (targetRole === 'tutor' && payload.tutorEmail) {
    recipients.add(payload.tutorEmail.trim().toLowerCase());
  }
  if (targetRole === 'student' && payload.studentEmail) {
    recipients.add(payload.studentEmail.trim().toLowerCase());
  }

  // 2. Bound Teacher-Student Tuple Check (Highest Precision)
  if (payload.tupleId) {
    try {
      const { supabase, isSupabaseConfigured } = await import('../config/supabase.js');
      if (isSupabaseConfigured && supabase) {
        const { data: pair } = await supabase
          .from('tutor_student_pairs')
          .select('*')
          .eq('id', payload.tupleId)
          .single();

        if (pair) {
          if (targetRole === 'tutor' && pair.tutor_email) {
            recipients.add(pair.tutor_email.trim().toLowerCase());
          } else if (targetRole === 'student' && pair.student_email) {
            recipients.add(pair.student_email.trim().toLowerCase());
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Target Recipient] Tuple pair lookup notice:', err.message);
    }
  }

  // 3. Query Supabase app_users for corresponding recipient
  try {
    const { supabase, isSupabaseConfigured } = await import('../config/supabase.js');
    if (isSupabaseConfigured && supabase) {
      // If student ID or Tutor ID available, query specific user
      if (targetRole === 'student' && payload.studentId) {
        const { data: specificStudent } = await supabase
          .from('app_users')
          .select('email')
          .eq('id', payload.studentId)
          .single();
        if (specificStudent?.email) {
          recipients.add(specificStudent.email.trim().toLowerCase());
        }
      } else if (targetRole === 'tutor' && payload.tutorId) {
        const { data: specificTutor } = await supabase
          .from('app_users')
          .select('email')
          .eq('id', payload.tutorId)
          .single();
        if (specificTutor?.email) {
          recipients.add(specificTutor.email.trim().toLowerCase());
        }
      }

      // If no specific recipient found yet, get all users matching the target role
      if (recipients.size === 0) {
        const { data: roleUsers } = await supabase
          .from('app_users')
          .select('email')
          .eq('role', targetRole);

        if (roleUsers) {
          for (const u of roleUsers) {
            if (u.email && u.email.includes('@')) {
              recipients.add(u.email.trim().toLowerCase());
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [Target Recipient] Error resolving recipient email:', err.message);
  }

  // 3. Fallbacks from environment variables
  if (targetRole === 'tutor') {
    if (recipients.size === 0) {
      if (process.env.TUTOR_EMAIL) recipients.add(process.env.TUTOR_EMAIL.trim().toLowerCase());
      if (process.env.SMTP_USER) recipients.add(process.env.SMTP_USER.trim().toLowerCase());
    }
  } else {
    // targetRole === 'student'
    if (recipients.size === 0 && process.env.STUDENT_EMAIL) {
      recipients.add(process.env.STUDENT_EMAIL.trim().toLowerCase());
    }
  }

  return Array.from(recipients);
}

// Compatibility alias
export const getNotificationRecipients = async () => {
  return getTargetRecipientEmails({
    event: 'status_updated',
    taskTitle: '',
    actorName: '',
    actorRole: 'student'
  });
};

/**
 * Builds responsive soft-pastel HTML email template for task modifications
 */
export function buildTaskChangeEmailTemplate(payload: TaskChangeNotificationPayload): string {
  const { event, taskTitle, subject = 'General', priority = 'medium', actorName, actorRole, oldStatus, newStatus, details } = payload;

  let eventBadge = '📌 Task Update';
  let eventColor = '#6F65F1';
  let eventBg = '#EEF0FD';
  let eventIcon = '📋';
  let actionTitle = 'Task Notification';

  switch (event) {
    case 'task_created':
      eventBadge = '🆕 New Task Assigned';
      eventColor = '#10B981';
      eventBg = '#ECFDF5';
      eventIcon = '🎯';
      actionTitle = 'New Learning Task Assigned';
      break;
    case 'status_updated':
      eventBadge = `🔄 Status Changed: ${newStatus?.toUpperCase() || ''}`;
      eventColor = '#F59E0B';
      eventBg = '#FEF3C7';
      eventIcon = '⚡';
      actionTitle = 'Timeline Status Updated';
      break;
    case 'attachment_added':
      eventBadge = '📎 Problem Screenshot / Question Attached';
      eventColor = '#8B5CF6';
      eventBg = '#F3E8FF';
      eventIcon = '📸';
      actionTitle = 'New Homework Problem Attached';
      break;
    case 'comment_added':
      eventBadge = '💬 Guidance / Feedback Added';
      eventColor = '#3B82F6';
      eventBg = '#EFF6FF';
      eventIcon = '💡';
      actionTitle = 'New Message in Task Dialogue';
      break;
    case 'task_deleted':
      eventBadge = '🗑️ Task Deleted by Tutor';
      eventColor = '#EF4444';
      eventBg = '#FEE2E2';
      eventIcon = '⚠️';
      actionTitle = 'Task Removed from Timeline';
      break;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://muhiuddin-student-manager.vercel.app';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F5F9; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E2E6F0; box-shadow: 0 10px 30px rgba(111, 101, 241, 0.06);" cellspacing="0" cellpadding="0">
          
          <!-- Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); padding: 30px 25px; text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; font-size: 22px; margin-bottom: 10px;">
                ${eventIcon}
              </div>
              <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                TutorFlow Activity Alert
              </h1>
              <p style="color: #E0E2FF; font-size: 13px; margin: 4px 0 0 0; font-weight: 500;">
                Home Tutor & Student Learning Notification
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px 28px;">
              <!-- Event Badge -->
              <div style="display: inline-block; background-color: ${eventBg}; color: ${eventColor}; border: 1px solid ${eventColor}33; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-bottom: 18px;">
                ${eventBadge}
              </div>

              <h2 style="font-size: 18px; font-weight: 800; color: #1D2132; margin: 0 0 12px 0;">
                ${taskTitle}
              </h2>

              <!-- Details Card -->
              <table role="presentation" width="100%" style="background-color: #F8F9FD; border-radius: 14px; border: 1px solid #ECEFF6; margin-bottom: 20px; font-size: 13px;" cellpadding="10" cellspacing="0">
                <tr>
                  <td style="color: #7A8297; width: 35%; border-bottom: 1px solid #ECEFF6; font-weight: 600;">Subject:</td>
                  <td style="color: #1D2132; border-bottom: 1px solid #ECEFF6; font-weight: 700;">${subject}</td>
                </tr>
                <tr>
                  <td style="color: #7A8297; border-bottom: 1px solid #ECEFF6; font-weight: 600;">Action By:</td>
                  <td style="color: #1D2132; border-bottom: 1px solid #ECEFF6; font-weight: 700;">${actorName} (${actorRole})</td>
                </tr>
                ${newStatus ? `
                <tr>
                  <td style="color: #7A8297; border-bottom: 1px solid #ECEFF6; font-weight: 600;">Current Status:</td>
                  <td style="color: #6F65F1; border-bottom: 1px solid #ECEFF6; font-weight: 800; text-transform: uppercase;">${newStatus}</td>
                </tr>` : ''}
                <tr>
                  <td style="color: #7A8297; font-weight: 600;">Priority:</td>
                  <td style="color: #1D2132; font-weight: 700; text-transform: capitalize;">${priority}</td>
                </tr>
              </table>

              ${details ? `
              <div style="background-color: #FAFBFD; border-left: 4px solid #6F65F1; padding: 12px 16px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                <div style="font-size: 11px; color: #8F97AC; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Details / Message</div>
                <div style="font-size: 13.5px; color: #2D334A; line-height: 1.5;">${details}</div>
              </div>` : ''}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 26px 0 10px 0;">
                <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(111, 101, 241, 0.25);">
                  Open TutorFlow Dashboard →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FD; padding: 16px 25px; text-align: center; border-top: 1px solid #ECEFF6;">
              <p style="margin: 0; font-size: 11.5px; color: #9FA6BA;">
                Automated alert dispatched to corresponding ${actorRole === 'student' ? 'Teacher / Tutor' : 'Student'}.
              </p>
              <p style="margin: 3px 0 0 0; font-size: 10.5px; color: #B5BAC9;">
                © ${new Date().getFullYear()} TutorFlow. All rights reserved.
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

/**
 * Sends a task modification notification email to the corresponding teacher or student only
 */
export async function sendTaskChangeNotificationEmail(
  payload: TaskChangeNotificationPayload
): Promise<void> {
  const recipients = await getTargetRecipientEmails(payload);
  const targetLabel = payload.actorRole === 'student' ? 'Teacher / Tutor' : 'Student';

  if (recipients.length === 0) {
    console.log(`ℹ️ [Nodemailer] No corresponding ${targetLabel} recipient email found to notify for action by ${payload.actorRole}.`);
    return;
  }

  const mailer = getTransporter();
  const user = process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (user ? `"TutorFlow" <${user}>` : '"TutorFlow" <noreply@tutorflow.com>');

  const eventPrefix = payload.event === 'task_created' ? '🎯 New Task'
    : payload.event === 'status_updated' ? `🔄 Status: ${payload.newStatus}`
    : payload.event === 'attachment_added' ? '📸 New Attachment'
    : payload.event === 'comment_added' ? '💬 Guidance Note'
    : '🗑️ Task Removed';

  const subject = `[TutorFlow] ${eventPrefix} - ${payload.taskTitle}`;
  const html = buildTaskChangeEmailTemplate(payload);
  const text = `TutorFlow Notification: ${eventPrefix} on "${payload.taskTitle}". Action taken by ${payload.actorName} (${payload.actorRole}). Delivered to corresponding ${targetLabel}. Details: ${payload.details || 'None'}`;

  try {
    const info = await mailer.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject,
      text,
      html
    });

    console.log(`✉️  [Nodemailer] Action by ${payload.actorRole} (${payload.actorName}): email sent to corresponding ${targetLabel} [${recipients.join(', ')}] (ID: ${info.messageId})`);
  } catch (err: any) {
    console.error('⚠️  [Nodemailer Error] Failed to send task notification email:', err.message);
  }
}

/**
 * Sends a notification email to Teacher when a student requests a connection/group
 */
export async function sendTupleRequestEmail(params: {
  tutorName: string;
  tutorEmail: string;
  studentName: string;
  studentEmail: string;
}): Promise<void> {
  const { tutorName, tutorEmail, studentName, studentEmail } = params;
  if (!tutorEmail || !tutorEmail.includes('@')) return;

  const mailer = getTransporter();
  const user = process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (user ? `"TutorFlow" <${user}>` : '"TutorFlow" <noreply@tutorflow.com>');
  const frontendUrl = process.env.FRONTEND_URL || 'https://muhiuddin-student-manager.vercel.app';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>New Student Connection Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F5F9; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E2E6F0; box-shadow: 0 10px 30px rgba(111, 101, 241, 0.06);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); padding: 30px 25px; text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; font-size: 22px; margin-bottom: 10px;">
                🎓
              </div>
              <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0;">New Student Request</h1>
              <p style="color: #E0E2FF; font-size: 13px; margin: 4px 0 0 0;">TutorFlow Connection Pairing</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 28px;">
              <div style="display: inline-block; background-color: #EEF0FD; color: #6F65F1; border: 1px solid #DCE0FA; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-bottom: 18px;">
                👥 Pair Request
              </div>
              <h2 style="font-size: 18px; font-weight: 800; color: #1D2132; margin: 0 0 12px 0;">
                Hello, Teacher ${tutorName || 'Tutor'}!
              </h2>
              <p style="font-size: 14px; color: #5C6478; line-height: 1.6; margin: 0 0 20px 0;">
                Student <strong>${studentName}</strong> (<em>${studentEmail}</em>) has requested to connect with you on TutorFlow to create a shared learning group.
              </p>
              <div style="background-color: #FAFBFD; border: 1px solid #ECEFF6; border-radius: 14px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; color: #7A8297;">Student Name: <strong style="color: #1D2132;">${studentName}</strong></div>
                <div style="font-size: 13px; color: #7A8297; margin-top: 6px;">Student Email: <strong style="color: #1D2132;">${studentEmail}</strong></div>
                <div style="font-size: 13px; color: #7A8297; margin-top: 6px;">Status: <span style="color: #F59E0B; font-weight: 700;">Pending Your Acceptance</span></div>
              </div>
              <div style="text-align: center; margin: 26px 0 10px 0;">
                <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(111, 101, 241, 0.25);">
                  Review & Accept Request →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8F9FD; padding: 16px 25px; text-align: center; border-top: 1px solid #ECEFF6;">
              <p style="margin: 0; font-size: 11px; color: #9FA6BA;">
                Log into TutorFlow to accept or decline student connection requests.
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

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: tutorEmail,
      subject: `[TutorFlow] 🎓 Student Connection Request from ${studentName}`,
      text: `Hello ${tutorName}, Student ${studentName} (${studentEmail}) has requested to connect with you on TutorFlow. Log into your dashboard to review and accept.`,
      html
    });
    console.log(`✉️  [Nodemailer] Dispatched tuple request email to tutor [${tutorEmail}]`);
  } catch (err: any) {
    console.error('⚠️  [Nodemailer Error] Failed to send tuple request email:', err.message);
  }
}

/**
 * Sends a notification email to Student when a Teacher accepts or rejects their connection request
 */
export async function sendTupleResponseEmail(params: {
  studentName: string;
  studentEmail: string;
  tutorName: string;
  tutorEmail: string;
  status: 'accepted' | 'rejected';
}): Promise<void> {
  const { studentName, studentEmail, tutorName, status } = params;
  if (!studentEmail || !studentEmail.includes('@')) return;

  const mailer = getTransporter();
  const user = process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (user ? `"TutorFlow" <${user}>` : '"TutorFlow" <noreply@tutorflow.com>');
  const frontendUrl = process.env.FRONTEND_URL || 'https://muhiuddin-student-manager.vercel.app';
  const isAccepted = status === 'accepted';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Connection Request Update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F5F9; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E2E6F0; box-shadow: 0 10px 30px rgba(111, 101, 241, 0.06);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="background: linear-gradient(135deg, ${isAccepted ? '#10B981, #059669' : '#EF4444, #DC2626'}); padding: 30px 25px; text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); border-radius: 50%; width: 44px; height: 44px; line-height: 44px; font-size: 22px; margin-bottom: 10px;">
                ${isAccepted ? '🎉' : 'ℹ️'}
              </div>
              <h1 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0;">
                ${isAccepted ? 'Connection Accepted!' : 'Request Update'}
              </h1>
              <p style="color: #FFFFFFDD; font-size: 13px; margin: 4px 0 0 0;">Teacher Pairing Status</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 28px;">
              <h2 style="font-size: 18px; font-weight: 800; color: #1D2132; margin: 0 0 12px 0;">
                Hello, ${studentName}!
              </h2>
              <p style="font-size: 14px; color: #5C6478; line-height: 1.6; margin: 0 0 20px 0;">
                ${isAccepted
                  ? `Great news! Teacher <strong>${tutorName}</strong> has accepted your request. Your shared study timeline, tasks, and weekly routine are now active and synchronized.`
                  : `Teacher <strong>${tutorName}</strong> was unable to accept your connection request at this time. You can choose another tutor from the Teacher list.`}
              </p>
              <div style="text-align: center; margin: 26px 0 10px 0;">
                <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(111, 101, 241, 0.25);">
                  ${isAccepted ? 'Open Your Shared Dashboard →' : 'Browse Other Teachers →'}
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8F9FD; padding: 16px 25px; text-align: center; border-top: 1px solid #ECEFF6;">
              <p style="margin: 0; font-size: 11px; color: #9FA6BA;">
                TutorFlow Home Tutor & Student Timeline Hub
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

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: studentEmail,
      subject: `[TutorFlow] ${isAccepted ? '🎉 Connection Accepted by' : 'Notice from'} Teacher ${tutorName}`,
      text: `Hello ${studentName}, Teacher ${tutorName} has ${status} your connection request on TutorFlow. Log into your dashboard to proceed.`,
      html
    });
    console.log(`✉️  [Nodemailer] Dispatched tuple response email to student [${studentEmail}] (${status})`);
  } catch (err: any) {
    console.error('⚠️  [Nodemailer Error] Failed to send tuple response email:', err.message);
  }
}

export interface DailyRoutineEmailParams {
  studentEmail: string;
  studentName: string;
  day: DayOfWeek;
  dateStr: string;
  routines: RoutineItem[];
  tutorName?: string;
}

/**
 * Sends automated 6:00 AM daily routine schedule email exclusively to the student
 */
export async function sendDailyRoutineEmail(params: DailyRoutineEmailParams): Promise<boolean> {
  const { studentEmail, studentName, day, dateStr, routines, tutorName } = params;
  if (!studentEmail || !studentEmail.includes('@')) return false;

  const mailer = getTransporter();
  const user = process.env.SMTP_USER;
  const fromAddress = process.env.SMTP_FROM || (user ? `"TutorFlow" <${user}>` : '"TutorFlow" <noreply@tutorflow.com>');
  const frontendUrl = process.env.FRONTEND_URL || 'https://muhiuddin-student-manager.vercel.app';

  const routinesCount = routines.length;
  const hasRoutines = routinesCount > 0;

  // Build the list of routine items in HTML
  const routinesListHtml = hasRoutines
    ? routines.map((r) => `
      <div style="background-color: #FFFFFF; border: 1.5px solid #E2E6F0; border-radius: 16px; padding: 16px 18px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="display: inline-block; background-color: #EEF0FD; color: #6F65F1; border: 1px solid #DCE0FA; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;">
                ⏰ ${r.time_slot || 'Flexible Slot'}
              </span>
              <span style="display: inline-block; background-color: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; margin-left: 6px;">
                📚 ${r.subject}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 10px;">
              <strong style="color: #1D2132; font-size: 15px; font-weight: 800;">${r.topic}</strong>
              ${r.note ? `<p style="margin: 6px 0 0 0; color: #5C6478; font-size: 13px; line-height: 1.45; font-style: italic;">"${r.note}"</p>` : ''}
              ${r.creator_name ? `<p style="margin: 6px 0 0 0; color: #9AA1B6; font-size: 11px; font-weight: 600;">Scheduled by: ${r.creator_name}</p>` : ''}
            </td>
          </tr>
        </table>
      </div>
    `).join('')
    : `
      <div style="background-color: #FAFBFD; border: 1.5px dashed #DCE0FA; border-radius: 18px; padding: 26px 20px; text-align: center; margin-bottom: 16px;">
        <div style="font-size: 32px; margin-bottom: 8px;">✨</div>
        <h3 style="margin: 0 0 6px 0; color: #1D2132; font-size: 16px; font-weight: 800;">No Scheduled Classes Today</h3>
        <p style="margin: 0; color: #5C6478; font-size: 13px; line-height: 1.5; max-width: 380px; margin-inline: auto;">
          You don't have any fixed timetable sessions scheduled for ${day}. Use today to revise past topics, finish any open homework tasks, or enjoy a productive rest day!
        </p>
      </div>
    `;

  const subject = `🌅 Good Morning, ${studentName}! Your Study Routine for ${day} (${dateStr}) • TutorFlow`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F4F5F9; padding: 35px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #E2E6F0; box-shadow: 0 12px 35px rgba(111, 101, 241, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- Morning Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); padding: 32px 25px; text-align: center;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.22); border-radius: 50%; width: 50px; height: 50px; line-height: 50px; font-size: 26px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                🌅
              </div>
              <h1 style="color: #FFFFFF; font-size: 23px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                Good Morning, ${studentName}! ☀️
              </h1>
              <p style="color: #E0E2FF; font-size: 13.5px; margin: 6px 0 0 0; font-weight: 600;">
                Daily 6:00 AM Study Briefing • ${day}, ${dateStr}
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 26px;">
              <div style="display: inline-block; background-color: #EEF0FD; color: #6F65F1; border: 1px solid #DCE0FA; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; margin-bottom: 16px;">
                📅 Today's Schedule (${day})
              </div>

              <h2 style="font-size: 18px; font-weight: 800; color: #1D2132; margin: 0 0 8px 0;">
                ${hasRoutines ? `You have ${routinesCount} study ${routinesCount === 1 ? 'session' : 'sessions'} planned today` : 'Ready to start your day?'}
              </h2>
              <p style="font-size: 13.5px; color: #5C6478; line-height: 1.6; margin: 0 0 20px 0;">
                Here is your daily timetable summary prepared by TutorFlow. Check your upcoming sessions and tasks to stay focused and productive.
              </p>

              <!-- Routine Items List -->
              <div style="margin-bottom: 24px;">
                ${routinesListHtml}
              </div>

              <!-- Daily Motivation Chip -->
              <div style="background-color: #FAF5FF; border: 1px solid #E9D5FF; border-radius: 14px; padding: 14px 16px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="30" valign="top" style="font-size: 18px;">💡</td>
                    <td style="color: #6B21A8; font-size: 12.5px; line-height: 1.5; font-weight: 600;">
                      <em>"Small daily improvements over time lead to stunning results. Start early, stay organized, and check off each step!"</em>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Call to Action -->
              <div style="text-align: center; margin: 10px 0 15px 0;">
                <a href="${frontendUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6F65F1 0%, #8F85FF 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(111, 101, 241, 0.3);">
                  Open Study Dashboard & Start Work →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F9FD; padding: 18px 25px; text-align: center; border-top: 1px solid #ECEFF6;">
              <p style="margin: 0; font-size: 11.5px; color: #9AA1B6; line-height: 1.5;">
                🔔 This automated briefing is sent directly and exclusively to you as a student every morning at 6:00 AM.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #B9BFD0;">
                TutorFlow • Home Tutor & Student Timeline Hub
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

  try {
    await mailer.sendMail({
      from: fromAddress,
      to: studentEmail,
      subject,
      text: `Good morning ${studentName}! Here is your study routine for ${day} (${dateStr}): ${hasRoutines ? routines.map(r => `${r.time_slot}: ${r.subject} - ${r.topic}`).join('; ') : 'No classes scheduled today'}. Log into TutorFlow: ${frontendUrl}`,
      html
    });

    console.log(`✉️  [Daily 6 AM Routine] Sent morning study schedule for ${day} (${routines.length} sessions) to student [${studentEmail}]`);
    return true;
  } catch (err: any) {
    console.error(`⚠️  [Daily 6 AM Routine Error] Failed to send email to ${studentEmail}:`, err.message);
    return false;
  }
}


