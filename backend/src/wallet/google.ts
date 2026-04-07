import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config';
import { loadWalletUserData } from './userData';

const SCOPES = ['https://www.googleapis.com/auth/wallet_object.issuer'];
const API_BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

let cachedKey: ServiceAccountKey | null = null;
let classEnsured = false;

function loadServiceAccountKey(): ServiceAccountKey | null {
  if (cachedKey) return cachedKey;
  const { saKeyPath, saKeyJson } = config.wallet.google;

  let raw: string | null = null;
  if (saKeyJson) {
    raw = saKeyJson;
  } else if (saKeyPath) {
    const abs = path.isAbsolute(saKeyPath) ? saKeyPath : path.resolve(process.cwd(), saKeyPath);
    if (fs.existsSync(abs)) raw = fs.readFileSync(abs, 'utf8');
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ServiceAccountKey;
    if (!parsed.client_email || !parsed.private_key) return null;
    cachedKey = parsed;
    return cachedKey;
  } catch {
    return null;
  }
}

export function isGoogleWalletConfigured(): boolean {
  return Boolean(config.wallet.google.issuerId && loadServiceAccountKey());
}

function classId(): string {
  return `${config.wallet.google.issuerId}.${config.wallet.google.classSuffix}`;
}

function objectId(userId: string): string {
  return `${config.wallet.google.issuerId}.user_${userId.replace(/-/g, '')}`;
}

async function authedClient() {
  const key = loadServiceAccountKey();
  if (!key) throw new Error('Google Wallet not configured');
  const auth = new GoogleAuth({ credentials: key, scopes: SCOPES });
  return auth.getClient();
}

/** Idempotently create the pass class (template) on first use. */
async function ensurePassClass(): Promise<void> {
  if (classEnsured) return;
  const client = await authedClient();
  const id = classId();

  // Check whether the class already exists.
  try {
    await client.request({ url: `${API_BASE}/genericClass/${encodeURIComponent(id)}` });
    classEnsured = true;
    return;
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err;
  }

  // Create it.
  const classBody = {
    id,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['status']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['org']" }],
                },
              },
            },
          },
        ],
      },
    },
  };

  await client.request({
    url: `${API_BASE}/genericClass`,
    method: 'POST',
    data: classBody,
  });
  classEnsured = true;
}

function buildPassObject(data: Awaited<ReturnType<typeof loadWalletUserData>>) {
  return {
    id: objectId(data.userId),
    classId: classId(),
    state: 'ACTIVE',
    hexBackgroundColor: '#059669',
    logo: {
      sourceUri: { uri: `${config.baseUrl}/wallet-logo.png` },
      contentDescription: { defaultValue: { language: 'he', value: 'KeyPass' } },
    },
    cardTitle: {
      defaultValue: { language: 'he', value: 'KeyPass' },
    },
    subheader: {
      defaultValue: { language: 'he', value: 'בניין' },
    },
    header: {
      defaultValue: { language: 'he', value: data.userName || ' ' },
    },
    barcode: {
      type: 'QR_CODE',
      value: data.credentialId,
      alternateText: data.credentialId.slice(0, 8),
    },
    textModulesData: [
      { id: 'status', header: 'סטטוס', body: data.status },
      { id: 'org', header: 'בניין', body: data.orgName || ' ' },
      {
        id: 'doors',
        header: 'דלתות מורשות',
        body: data.doorNames.length ? data.doorNames.join('\n') : 'אין דלתות מוקצות',
      },
    ],
  };
}

/**
 * Returns the "Add to Google Wallet" save URL for a given user.
 * Ensures the pass class exists, signs a JWT containing the pass object,
 * and wraps it as https://pay.google.com/gp/v/save/<jwt>.
 */
export async function generateSaveUrl(userId: string): Promise<string> {
  if (!isGoogleWalletConfigured()) throw new Error('Google Wallet not configured');
  const key = loadServiceAccountKey()!;

  await ensurePassClass();
  const data = await loadWalletUserData(userId);
  const pass = buildPassObject(data);

  const claims = {
    iss: key.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [],
    payload: { genericObjects: [pass] },
  };

  const token = jwt.sign(claims, key.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

/** Mark a previously-issued pass as INACTIVE. Best-effort. */
export async function revokePass(userId: string): Promise<void> {
  if (!isGoogleWalletConfigured()) return;
  const client = await authedClient();
  const id = objectId(userId);
  try {
    await client.request({
      url: `${API_BASE}/genericObject/${encodeURIComponent(id)}`,
      method: 'PATCH',
      data: { state: 'INACTIVE' },
    });
  } catch (err) {
    console.warn('Google Wallet revoke failed:', err);
  }
}
