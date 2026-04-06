import { Request, Response, NextFunction } from 'express';

export function orgScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'לא מאומת' });
    return;
  }

  if (req.user.role === 'admin' && !req.user.orgId) {
    res.status(403).json({ error: 'חסר מזהה ארגון' });
    return;
  }

  next();
}

export function getOrgId(req: Request): string {
  if (req.user?.role === 'super_admin') {
    return req.params.orgId || req.body?.orgId || '';
  }
  return req.user?.orgId || '';
}
