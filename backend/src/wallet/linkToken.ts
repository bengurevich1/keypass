import jwt from 'jsonwebtoken';
import { config } from '../config';

export type WalletPlatform = 'google' | 'apple';

export interface WalletLinkPayload {
  userId: string;
  platform: WalletPlatform;
}

const AUDIENCE = 'wallet';
const EXPIRES_IN = '15m';

export function signWalletLink(payload: WalletLinkPayload): string {
  return jwt.sign(
    { sub: payload.userId, platform: payload.platform },
    config.jwt.secret,
    { audience: AUDIENCE, expiresIn: EXPIRES_IN },
  );
}

export function verifyWalletLink(token: string): WalletLinkPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret, { audience: AUDIENCE }) as
      { sub: string; platform: WalletPlatform };
    if (!decoded.sub || !decoded.platform) return null;
    if (decoded.platform !== 'google' && decoded.platform !== 'apple') return null;
    return { userId: decoded.sub, platform: decoded.platform };
  } catch {
    return null;
  }
}

export function buildPublicWalletUrl(platform: WalletPlatform, token: string): string {
  return `${config.baseUrl}/api/wallet/${platform}?t=${encodeURIComponent(token)}`;
}
