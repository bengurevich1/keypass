import crypto from 'crypto';

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('base64');
}

// Simplified Ed25519 verification for server-side
// In production, use a proper Ed25519 library
export function verifySignature(publicKey: string, challenge: string, signature: string): boolean {
  try {
    const pubKeyBuffer = Buffer.from(publicKey, 'base64');
    const challengeBuffer = Buffer.from(challenge, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');

    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 public key DER prefix
        Buffer.from('302a300506032b6570032100', 'hex'),
        pubKeyBuffer,
      ]),
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(null, challengeBuffer, keyObject, signatureBuffer);
  } catch {
    return false;
  }
}
