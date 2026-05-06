// ============================================
// Address Service
// ============================================

import { AddressListData, AddressSummary } from '@yurdeals/shared';
import { AppError } from '../middleware/errorHandler';
import { addressRepository } from '../repositories/address.repository';
import { CreateAddressInput, UpdateAddressInput } from '../schemas/address.schema';

export async function listAddresses(userId: string): Promise<AddressListData> {
  const addresses = await addressRepository.findByUserId(userId);
  return { addresses };
}

export async function createAddress(
  userId: string,
  input: CreateAddressInput,
): Promise<{ address: AddressSummary }> {
  const address = await addressRepository.create(userId, input);
  return { address };
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
): Promise<{ address: AddressSummary }> {
  const address = await addressRepository.update(userId, addressId, input);

  if (!address) {
    throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  return { address };
}

export async function deleteAddress(userId: string, addressId: string): Promise<null> {
  const deleted = await addressRepository.delete(userId, addressId);

  if (!deleted) {
    throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  return null;
}

export async function setDefaultAddress(
  userId: string,
  addressId: string,
): Promise<{ address: AddressSummary }> {
  const address = await addressRepository.setDefault(userId, addressId);

  if (!address) {
    throw new AppError('Address not found', 404, 'ADDRESS_NOT_FOUND');
  }

  return { address };
}
