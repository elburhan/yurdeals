// ============================================
// Address Validation Schemas
// ============================================

import { z } from 'zod';

const addressFields = {
  label: z.string().trim().max(50, 'Label must be at most 50 characters').optional(),
  first_name: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  last_name: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters'),
  phone: z
    .string({ required_error: 'Phone is required' })
    .trim()
    .min(5, 'Phone must be at least 5 characters')
    .max(20, 'Phone must be at most 20 characters'),
  street: z
    .string({ required_error: 'Street is required' })
    .trim()
    .min(3, 'Street must be at least 3 characters')
    .max(255, 'Street must be at most 255 characters'),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be at most 100 characters'),
  state: z
    .string({ required_error: 'State is required' })
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(100, 'State must be at most 100 characters'),
  country: z.string().trim().min(2).max(100).optional().default('Nigeria'),
  postal_code: z.string().trim().max(20).optional(),
  is_default: z.boolean().optional().default(false),
};

export const createAddressSchema = z.object(addressFields);

export const updateAddressSchema = z.object({
  label: addressFields.label,
  first_name: addressFields.first_name.optional(),
  last_name: addressFields.last_name.optional(),
  phone: addressFields.phone.optional(),
  street: addressFields.street.optional(),
  city: addressFields.city.optional(),
  state: addressFields.state.optional(),
  country: z.string().trim().min(2).max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  is_default: z.boolean().optional(),
});

export const addressParamsSchema = z.object({
  addressId: z.string().cuid('Invalid address id'),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type AddressParamsInput = z.infer<typeof addressParamsSchema>;
