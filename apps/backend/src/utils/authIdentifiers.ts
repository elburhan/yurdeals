export interface NormalizedIdentifier {
  type: 'email' | 'phone';
  canonical: string;
  variants: string[];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }

  if (hasLeadingPlus) {
    return `+${digits}`;
  }

  return digits;
}

export function expandPhoneLookupVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  const digitsOnly = normalized.replace(/^\+/, '');
  variants.add(digitsOnly);

  if (normalized.startsWith('+234') && normalized.length === 14) {
    variants.add(`0${normalized.slice(4)}`);
  }

  if (digitsOnly.startsWith('234') && digitsOnly.length === 13) {
    variants.add(`0${digitsOnly.slice(3)}`);
  }

  const compactOriginal = phone.trim().replace(/[^\d+]/g, '');
  if (compactOriginal) {
    variants.add(compactOriginal);
  }

  return Array.from(variants);
}

export function normalizeAuthIdentifier(identifier: string): NormalizedIdentifier {
  const trimmed = identifier.trim();

  if (trimmed.includes('@')) {
    const email = normalizeEmail(trimmed);
    return {
      type: 'email',
      canonical: email,
      variants: [email],
    };
  }

  const canonical = normalizePhone(trimmed);
  return {
    type: 'phone',
    canonical,
    variants: expandPhoneLookupVariants(trimmed),
  };
}
