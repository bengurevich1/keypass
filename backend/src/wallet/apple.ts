import fs from 'fs';
import path from 'path';
import { PKPass } from 'passkit-generator';
import { config } from '../config';
import { loadWalletUserData } from './userData';

interface CertBundle {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
}

let cachedCerts: CertBundle | null = null;

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function loadCerts(): CertBundle | null {
  if (cachedCerts) return cachedCerts;
  const { certPath, keyPath, wwdrPath, keyPassphrase } = config.wallet.apple;
  if (!certPath || !keyPath || !wwdrPath) return null;
  const cert = resolvePath(certPath);
  const key = resolvePath(keyPath);
  const wwdr = resolvePath(wwdrPath);
  if (!fs.existsSync(cert) || !fs.existsSync(key) || !fs.existsSync(wwdr)) return null;
  cachedCerts = {
    wwdr: fs.readFileSync(wwdr),
    signerCert: fs.readFileSync(cert),
    signerKey: fs.readFileSync(key),
    signerKeyPassphrase: keyPassphrase || undefined,
  };
  return cachedCerts;
}

export function isAppleWalletConfigured(): boolean {
  if (!config.wallet.apple.passTypeId || !config.wallet.apple.teamId) return false;
  if (!loadCerts()) return false;
  const modelDir = resolvePath(config.wallet.apple.modelDir);
  return fs.existsSync(modelDir);
}

/**
 * Builds a .pkpass Buffer for the given user.
 * Throws if Apple Wallet is not configured.
 */
export async function buildPkpass(userId: string): Promise<Buffer> {
  const certs = loadCerts();
  if (!certs) throw new Error('Apple Wallet not configured');
  const modelDir = resolvePath(config.wallet.apple.modelDir);
  if (!fs.existsSync(modelDir)) throw new Error('Apple pass model directory missing');

  const data = await loadWalletUserData(userId);

  const pass = await PKPass.from(
    {
      model: modelDir,
      certificates: certs,
    },
    {
      serialNumber: data.userId,
      passTypeIdentifier: config.wallet.apple.passTypeId,
      teamIdentifier: config.wallet.apple.teamId,
      organizationName: 'KeyPass',
      description: 'KeyPass membership card',
    },
  );

  // storeCard fields are written via the underlying pass.json — passkit-generator exposes
  // helpers for fields, barcodes, and localization.
  pass.headerFields.push({
    key: 'status',
    label: 'סטטוס',
    value: data.status,
  });
  pass.primaryFields.push({
    key: 'name',
    label: 'משתמש',
    value: data.userName || ' ',
  });
  pass.secondaryFields.push({
    key: 'org',
    label: 'בניין',
    value: data.orgName || ' ',
  });
  pass.backFields.push(
    {
      key: 'doors',
      label: 'דלתות מורשות',
      value: data.doorNames.length ? data.doorNames.join('\n') : 'אין דלתות מוקצות',
    },
    {
      key: 'support',
      label: 'תמיכה',
      value: 'לתמיכה פנה למנהל הבניין',
    },
  );

  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message: data.credentialId,
    messageEncoding: 'iso-8859-1',
    altText: data.credentialId.slice(0, 8),
  });

  return pass.getAsBuffer();
}
