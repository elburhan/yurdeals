import {
  isKnownNigeriaLga,
  isKnownNigeriaState,
  OTHER_NIGERIA_LGA,
} from '@yurdeals/shared';

const JUNK_ADDRESS_VALUES = new Set([
  '123',
  '1234',
  'abc',
  'asdf',
  'home',
  'house',
  'my house',
  'near road',
  'near the road',
  'road',
  'street',
  'none',
  'nil',
  'n/a',
  'na',
  'test',
  'unknown',
]);

export function hasOperationalAddressText(value: string, minimumLength: number): boolean {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();

  if (normalized.length < minimumLength) {
    return false;
  }

  if (JUNK_ADDRESS_VALUES.has(normalized)) {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return false;
  }

  return /[a-z]/i.test(normalized);
}

export function isValidNigeriaState(value: string): boolean {
  return isKnownNigeriaState(value);
}

export function isValidNigeriaLga(state: string, lga: string): boolean {
  return lga === OTHER_NIGERIA_LGA || isKnownNigeriaLga(state, lga);
}
