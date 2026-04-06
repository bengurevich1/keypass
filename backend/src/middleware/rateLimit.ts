import { Request, Response, NextFunction } from 'express';

// Rate limiting disabled for dev/MVP
const noOp = (_req: Request, _res: Response, next: NextFunction) => next();

export const loginLimiter = noOp;
export const otpLimiter = noOp;
export const apiLimiter = noOp;
