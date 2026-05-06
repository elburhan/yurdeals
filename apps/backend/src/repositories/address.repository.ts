// ============================================
// Address Repository
// ============================================

import { Prisma } from '@prisma/client';
import { AddressSummary } from '@yurdeals/shared';
import { prisma } from '../config';
import { CreateAddressInput, UpdateAddressInput } from '../schemas/address.schema';

const ADDRESS_SELECT = {
  id: true,
  label: true,
  firstName: true,
  lastName: true,
  phone: true,
  street: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

type AddressRecord = Prisma.AddressGetPayload<{ select: typeof ADDRESS_SELECT }>;

export class AddressRepository {
  async findByUserId(userId: string): Promise<AddressSummary[]> {
    const addresses = await prisma.address.findMany({
      where: { userId },
      select: ADDRESS_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map(mapAddress);
  }

  async findOwnedAddress(userId: string, addressId: string): Promise<AddressSummary | null> {
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: ADDRESS_SELECT,
    });

    return address ? mapAddress(address) : null;
  }

  async create(userId: string, input: CreateAddressInput): Promise<AddressSummary> {
    const address = await prisma.$transaction(async (tx) => {
      if (input.is_default) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: toAddressData(userId, input),
        select: ADDRESS_SELECT,
      });
    });

    return mapAddress(address);
  }

  async update(
    userId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<AddressSummary | null> {
    const address = await prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
        where: { id: addressId, userId },
        select: { id: true },
      });

      if (!existingAddress) {
        return null;
      }

      if (input.is_default) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: toAddressUpdateData(input),
        select: ADDRESS_SELECT,
      });
    });

    return address ? mapAddress(address) : null;
  }

  async delete(userId: string, addressId: string): Promise<boolean> {
    const result = await prisma.address.deleteMany({
      where: { id: addressId, userId },
    });

    return result.count > 0;
  }

  async setDefault(userId: string, addressId: string): Promise<AddressSummary | null> {
    const address = await prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
        where: { id: addressId, userId },
        select: { id: true },
      });

      if (!existingAddress) {
        return null;
      }

      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
        select: ADDRESS_SELECT,
      });
    });

    return address ? mapAddress(address) : null;
  }
}

function toAddressData(userId: string, input: CreateAddressInput): Prisma.AddressCreateInput {
  return {
    user: { connect: { id: userId } },
    label: input.label ?? null,
    firstName: input.first_name,
    lastName: input.last_name,
    phone: input.phone,
    street: input.street,
    city: input.city,
    state: input.state,
    country: input.country,
    postalCode: input.postal_code ?? null,
    isDefault: input.is_default,
  };
}

function toAddressUpdateData(input: UpdateAddressInput): Prisma.AddressUpdateInput {
  return {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.first_name !== undefined ? { firstName: input.first_name } : {}),
    ...(input.last_name !== undefined ? { lastName: input.last_name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.street !== undefined ? { street: input.street } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.postal_code !== undefined ? { postalCode: input.postal_code } : {}),
    ...(input.is_default !== undefined ? { isDefault: input.is_default } : {}),
  };
}

function mapAddress(address: AddressRecord): AddressSummary {
  return {
    id: address.id,
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    street: address.street,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export const addressRepository = new AddressRepository();
