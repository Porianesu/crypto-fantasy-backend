import { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET as string;

export function verifyToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth || typeof auth !== 'string') return null;
  const token = auth.replace(/^Bearer\s+/i, '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    return decoded.email;
  } catch {
    return null;
  }
}

export function signToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });
}
