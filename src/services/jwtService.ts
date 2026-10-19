import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Role } from '../types/index.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'tutorflow_jwt_secret_key_2026_super_secure_key_12345';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Generates a signed JWT token
 */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verifies and decodes a JWT token
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
