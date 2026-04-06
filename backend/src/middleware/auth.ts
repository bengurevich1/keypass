import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  id: string;
  role: 'super_admin' | 'admin' | 'user';
  orgId?: string;
  credentialId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'טוקן אימות חסר' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'טוקן לא תקין או פג תוקף' });
  }
}

export function requireRole(...roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'לא מאומת' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'אין הרשאה לפעולה זו' });
      return;
    }
    next();
  };
}

export function generateTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload as object, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn as any,
  });
  const refreshToken = jwt.sign(payload as object, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as any,
  });
  return { accessToken, refreshToken };
}
