import { Request, Response } from 'express';
import * as authService from '../services/authService.js';
import * as jwtService from '../services/jwtService.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      return;
    }

    const result = await authService.initiateRegistration({ name, email, password, role });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Registration failed' });
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, message: 'Email and verification code are required' });
      return;
    }

    const result = await authService.verifyEmailAndRegister({ email, code });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Verification failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are both required to log in.' });
      return;
    }

    const result = await authService.loginWithPassword({ email, password });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message || 'Login failed' });
  }
}

export async function verifyLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, message: 'Email and 6-digit code are required.' });
      return;
    }

    const result = await authService.verifyLoginOtp({ email, code });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Login OTP verification failed' });
  }
}

export async function resendCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, type } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const result = await authService.resendVerificationCode(email, type || 'login');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to resend code' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = jwtService.verifyJwt(token);
    if (!payload) {
      res.status(401).json({ success: false, message: 'Session expired or invalid token' });
      return;
    }

    const user = await authService.getUserByIdOrEmail(payload.id, payload.email);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, user });
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message || 'Authentication failed' });
  }
}

export async function switchRole(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;
    if (role !== 'student' && role !== 'tutor') {
      res.status(400).json({ success: false, message: 'Role must be student or tutor' });
      return;
    }

    const result = await authService.switchRole(role);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to switch role' });
  }
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;
    if (role !== 'student' && role !== 'tutor') {
      res.status(400).json({ success: false, message: 'Role must be student or tutor' });
      return;
    }

    const result = await authService.quickDemoLogin(role);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Demo login failed' });
  }
}


