const ISRAELI_PHONE_REGEX = /^05\d{8}$/;

export function validateIsraeliPhone(phone: string): boolean {
  const cleaned = phone.replace(/[-\s]/g, '');
  return ISRAELI_PHONE_REGEX.test(cleaned);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[-\s]/g, '');
}

export function formatPhoneDisplay(phone: string): string {
  const cleaned = normalizePhone(phone);
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return cleaned;
}
