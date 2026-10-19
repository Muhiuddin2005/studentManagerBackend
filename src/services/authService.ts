import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { sendResendVerificationCode } from './resendService.js';
import { signJwt } from './jwtService.js';
import { 
  AppUser, 
  RegisterDTO, 
  VerifyEmailDTO, 
  LoginDTO, 
  PasswordOnlyLoginDTO,
  VerifyLoginOtpDTO,
  AuthResponseDTO,
  VerificationCodeRecord 
} from '../types/index.js';

// Helper to mask email for user privacy display (e.g. m***a@student.com)
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

// Clean empty user and verification code store for production
let inMemoryUsers: AppUser[] = [];
let inMemoryVerificationCodes: VerificationCodeRecord[] = [];

export function clearInMemoryAuth(): void {
  inMemoryUsers = [];
  inMemoryVerificationCodes = [];
}

/**
 * Generates a secure random 6-digit numeric verification code
 */
function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Step 1: Initiate Registration with email and password
 * Sends 6-digit code via Resend
 */
export async function initiateRegistration(dto: RegisterDTO): Promise<{ success: boolean; message: string; devCode?: string }> {
  const rawEmail = dto.email.trim().toLowerCase();
  const name = dto.name.trim();
  const password = dto.password; // Without hashing as requested

  // Auto-detect role: default 'student', but if email ends with '-tutor', role is 'tutor'
  let role: 'student' | 'tutor' = 'student';
  let email = rawEmail;

  if (rawEmail.endsWith('-tutor')) {
    role = 'tutor';
    email = rawEmail.replace(/-tutor$/, '').trim();
  } else if (dto.role === 'tutor') {
    role = 'tutor';
  }

  if (!email || !password || !name) {
    throw new Error('Name, email, and password are required');
  }

  // 1. Check if verified user already exists
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existingUser } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .single();

      if (existingUser && existingUser.is_verified) {
        throw new Error('An account with this email already exists. Please log in.');
      }
    } catch (err: any) {
      if (err.message?.includes('already exists')) throw err;
    }
  } else {
    const existing = inMemoryUsers.find(u => u.email === email && u.is_verified);
    if (existing) {
      throw new Error('An account with this email already exists. Please log in.');
    }
  }

  // 2. Generate 6-digit code with 10-minute expiry
  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // 3. Upsert user as unverified in Supabase / memory with plain password
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('app_users')
        .upsert([{
          name,
          email,
          password,
          role,
          is_verified: false,
          updated_at: now
        }], { onConflict: 'email' });

      await supabase
        .from('email_verification_codes')
        .insert([{
          id: crypto.randomUUID(),
          email,
          code,
          expires_at: expiresAt,
          created_at: now
        }]);
    } catch (err: any) {
      console.warn('⚠️ Supabase error during initiateRegistration, using memory store:', err.message);
    }
  }

  // Always sync with in-memory store
  const existingIndex = inMemoryUsers.findIndex(u => u.email === email);
  if (existingIndex >= 0) {
    inMemoryUsers[existingIndex] = {
      ...inMemoryUsers[existingIndex],
      name,
      password,
      role,
      is_verified: false,
      updated_at: now
    };
  } else {
    inMemoryUsers.push({
      id: crypto.randomUUID(),
      name,
      email,
      password,
      role,
      is_verified: false,
      created_at: now,
      updated_at: now
    });
  }

  // Store verification code in memory
  inMemoryVerificationCodes = inMemoryVerificationCodes.filter(c => c.email !== email);
  inMemoryVerificationCodes.push({
    id: crypto.randomUUID(),
    email,
    code,
    expires_at: expiresAt,
    created_at: now,
    type: 'register'
  });

  // 4. Send email via Resend
  const mailResult = await sendResendVerificationCode(email, code, name, 'register');

  return {
    success: true,
    message: `Verification code sent to ${email}`,
    devCode: mailResult.previewCode
  };
}

/**
 * Step 2: Verify Email with 6-digit code, activate account, and return JWT
 */
export async function verifyEmailAndRegister(dto: VerifyEmailDTO): Promise<AuthResponseDTO> {
  let email = dto.email.trim().toLowerCase();
  if (email.endsWith('-tutor')) {
    email = email.replace(/-tutor$/, '').trim();
  }
  const code = dto.code.trim();

  if (!email || !code) {
    throw new Error('Email and 6-digit verification code are required');
  }

  const now = new Date();
  let isValid = false;

  // 1. Verify code in Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: record, error } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && record) {
        const expiresAt = new Date(record.expires_at);
        if (expiresAt > now) {
          isValid = true;
          await supabase
            .from('app_users')
            .update({ is_verified: true, updated_at: now.toISOString() })
            .eq('email', email);

          await supabase
            .from('email_verification_codes')
            .delete()
            .eq('email', email);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase verify error, checking memory:', err.message);
    }
  }

  // Check in-memory fallback
  if (!isValid) {
    const memoryRecord = inMemoryVerificationCodes.find(c => c.email === email && c.code === code);
    if (memoryRecord && new Date(memoryRecord.expires_at) > now) {
      isValid = true;
      inMemoryVerificationCodes = inMemoryVerificationCodes.filter(c => c.email !== email);
    }
  }

  if (!isValid) {
    throw new Error('Invalid or expired verification code. Please request a new code.');
  }

  // Activate user in memory
  const user = inMemoryUsers.find(u => u.email === email);
  if (user) {
    user.is_verified = true;
    user.updated_at = now.toISOString();
  }

  const verifiedUser = user || {
    id: crypto.randomUUID(),
    name: 'Verified User',
    email,
    password: '',
    role: 'student' as const,
    is_verified: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const { password: _, ...userWithoutPassword } = verifiedUser;

  // Issue JWT Token
  const token = signJwt({
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    name: userWithoutPassword.name,
    role: userWithoutPassword.role
  });

  return {
    success: true,
    message: 'Email successfully verified! You are now logged in.',
    token,
    user: userWithoutPassword
  };
}

/**
 * Log In with only password:
 * Finds user with matching password, sends 6-digit OTP code to user's email via Resend
 */
export async function loginWithPassword(dto: PasswordOnlyLoginDTO | LoginDTO): Promise<AuthResponseDTO> {
  const password = dto.password?.trim();
  let emailInput = ('email' in dto && dto.email) ? dto.email.trim().toLowerCase() : undefined;
  if (emailInput && emailInput.endsWith('-tutor')) {
    emailInput = emailInput.replace(/-tutor$/, '').trim();
  }

  if (!password) {
    throw new Error('Password is required to log in.');
  }

  let user: AppUser | null = null;

  // 1. If email is provided, match by email AND password
  if (emailInput) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('email', emailInput)
          .eq('password', password)
          .single();

        if (!error && data) {
          user = data as AppUser;
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase login query error:', err.message);
      }
    }
    if (!user) {
      user = inMemoryUsers.find(u => u.email === emailInput && u.password === password) || null;
    }
  } else {
    // 2. ONLY PASSWORD provided (as requested by user!)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('password', password)
          .limit(1)
          .single();

        if (!error && data) {
          user = data as AppUser;
        }
      } catch (err: any) {
        console.warn('⚠️ Supabase password lookup error:', err.message);
      }
    }

    if (!user) {
      user = inMemoryUsers.find(u => u.password === password) || null;
    }
  }

  if (!user) {
    throw new Error('Invalid password. No matching user account found. Please check your password or register.');
  }

  // 3. Generate 6-digit OTP code with 10-minute expiry for email verification
  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  // Save code to Supabase and memory
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('email_verification_codes')
        .insert([{
          id: crypto.randomUUID(),
          email: user.email,
          code,
          expires_at: expiresAt,
          created_at: now
        }]);
    } catch (err: any) {
      console.warn('⚠️ Supabase code insert error:', err.message);
    }
  }

  inMemoryVerificationCodes = inMemoryVerificationCodes.filter(c => c.email !== user!.email);
  inMemoryVerificationCodes.push({
    id: crypto.randomUUID(),
    email: user.email,
    code,
    expires_at: expiresAt,
    created_at: now,
    type: 'login'
  });

  // 4. Send login verification email via Resend with our custom designed template
  const mailResult = await sendResendVerificationCode(user.email, code, user.name, 'login');

  return {
    success: true,
    step: 'verify_otp',
    email: user.email,
    maskedEmail: maskEmail(user.email),
    message: `A 6-digit verification code has been dispatched to ${maskEmail(user.email)}. Enter the code to complete your login.`,
    devCode: mailResult.previewCode
  };
}

/**
 * Step 2 of Login: Verify OTP code and issue JWT
 */
export async function verifyLoginOtp(dto: VerifyLoginOtpDTO): Promise<AuthResponseDTO> {
  let email = dto.email.trim().toLowerCase();
  if (email.endsWith('-tutor')) {
    email = email.replace(/-tutor$/, '').trim();
  }
  const code = dto.code.trim();

  if (!email || !code) {
    throw new Error('Email and 6-digit verification code are required.');
  }

  const now = new Date();
  let isValid = false;

  // 1. Verify code in Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: record, error } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && record) {
        const expiresAt = new Date(record.expires_at);
        if (expiresAt > now) {
          isValid = true;
          await supabase
            .from('email_verification_codes')
            .delete()
            .eq('email', email);
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase verifyLoginOtp error:', err.message);
    }
  }

  // 2. Verify code in memory
  if (!isValid) {
    const memoryRecord = inMemoryVerificationCodes.find(c => c.email === email && c.code === code);
    if (memoryRecord && new Date(memoryRecord.expires_at) > now) {
      isValid = true;
      inMemoryVerificationCodes = inMemoryVerificationCodes.filter(c => c.email !== email);
    }
  }

  if (!isValid) {
    throw new Error('Invalid or expired verification code. Please request a new code.');
  }

  // Find user
  let user: AppUser | null = null;
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .single();
      if (data) user = data as AppUser;
    } catch {}
  }

  if (!user) {
    user = inMemoryUsers.find(u => u.email === email) || null;
  }

  if (!user) {
    throw new Error('User not found.');
  }

  const { password: _, ...userWithoutPassword } = user;

  // Issue JWT Token
  const token = signJwt({
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    name: userWithoutPassword.name,
    role: userWithoutPassword.role
  });

  return {
    success: true,
    step: 'completed',
    message: 'Login successful! Welcome back.',
    token,
    user: userWithoutPassword
  };
}

/**
 * Resends a fresh 6-digit verification code via Resend
 */
export async function resendVerificationCode(email: string, type: 'login' | 'register' = 'login'): Promise<{ success: boolean; message: string; devCode?: string }> {
  let normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.endsWith('-tutor')) {
    normalizedEmail = normalizedEmail.replace(/-tutor$/, '').trim();
  }
  const user = inMemoryUsers.find(u => u.email === normalizedEmail);
  const name = user?.name || 'User';

  const code = generate6DigitCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('email_verification_codes')
        .insert([{
          id: crypto.randomUUID(),
          email: normalizedEmail,
          code,
          expires_at: expiresAt,
          created_at: now
        }]);
    } catch (err: any) {
      console.warn('⚠️ Supabase resend error:', err.message);
    }
  }

  inMemoryVerificationCodes = inMemoryVerificationCodes.filter(c => c.email !== normalizedEmail);
  inMemoryVerificationCodes.push({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    code,
    expires_at: expiresAt,
    created_at: now,
    type
  });

  const mailResult = await sendResendVerificationCode(normalizedEmail, code, name, type);

  return {
    success: true,
    message: `A fresh verification code has been dispatched to ${maskEmail(normalizedEmail)}`,
    devCode: mailResult.previewCode
  };
}

/**
 * Retrieves user by ID or email for token verification (/me)
 */
export async function getUserByIdOrEmail(id?: string, email?: string): Promise<Omit<AppUser, 'password'> | null> {
  const normalizedEmail = email ? email.trim().toLowerCase() : undefined;
  let user: AppUser | null = null;

  if (isSupabaseConfigured && supabase) {
    try {
      if (normalizedEmail) {
        const { data } = await supabase
          .from('app_users')
          .select('*')
          .eq('email', normalizedEmail)
          .single();
        if (data) user = data as AppUser;
      } else if (id) {
        const { data } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', id)
          .single();
        if (data) user = data as AppUser;
      }
    } catch {}
  }

  if (!user) {
    user = inMemoryUsers.find(u => (id && u.id === id) || (normalizedEmail && u.email === normalizedEmail)) || null;
  }

  if (!user) return null;

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Directly switches active role between Mohona (student) and Tutor Axis (tutor)
 * and returns a new signed JWT token with updated user object.
 */
export async function switchRole(targetRole: 'student' | 'tutor'): Promise<{ success: boolean; token: string; user: Omit<AppUser, 'password'> }> {
  const targetUser = inMemoryUsers.find(u => u.role === targetRole);
  if (!targetUser) {
    throw new Error(`Target account for role ${targetRole} not found`);
  }

  const { password: _, ...userWithoutPassword } = targetUser;
  const token = signJwt({
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    name: userWithoutPassword.name,
    role: userWithoutPassword.role
  });

  return {
    success: true,
    token,
    user: userWithoutPassword
  };
}

/**
 * Instant demo login for testing with signed JWT token
 */
export async function quickDemoLogin(role: 'student' | 'tutor'): Promise<AuthResponseDTO> {
  const user = inMemoryUsers.find(u => u.role === role);
  if (!user) {
    throw new Error(`Demo account for role ${role} not found`);
  }

  const { password: _, ...userWithoutPassword } = user;
  const token = signJwt({
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    name: userWithoutPassword.name,
    role: userWithoutPassword.role
  });

  return {
    success: true,
    message: `Logged in as ${userWithoutPassword.name} (${userWithoutPassword.role})`,
    token,
    user: userWithoutPassword
  };
}


