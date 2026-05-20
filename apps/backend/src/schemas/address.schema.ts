// ============================================
// Address Validation Schemas
// ============================================

import { z } from 'zod';
import {
  hasOperationalAddressText,
  isValidNigeriaLga,
  isValidNigeriaState,
} from '../utils/nigeriaAddressValidation';

const operationalText = (fieldName: string, minimumLength: number, maximumLength: number) =>
  z
    .string({ required_error: `${fieldName} is required` })
    .trim()
    .min(minimumLength, `${fieldName} must be more descriptive`)
    .max(maximumLength, `${fieldName} must be at most ${maximumLength} characters`)
    .refine(
      (value) => hasOperationalAddressText(value, minimumLength),
      `${fieldName} is too vague for delivery`,
    );

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
    .string({ required_error: 'Street address is required' })
    .trim()
    .min(5, 'Street address must be more descriptive')
    .max(255, 'Street address must be at most 255 characters')
    .refine((value) => hasOperationalAddressText(value, 5), 'Street address is too vague for delivery'),
  city: z
    .string({ required_error: 'City is required' })
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be at most 100 characters'),
  state: z
    .string({ required_error: 'State is required' })
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(100, 'State must be at most 100 characters')
    .refine(isValidNigeriaState, 'Select a valid Nigerian state'),
  lga: z
    .string({ required_error: 'LGA is required' })
    .trim()
    .min(2, 'LGA is required')
    .max(120, 'LGA must be at most 120 characters'),
  area: operationalText('Area or district', 3, 120),
  landmark: operationalText('Landmark', 8, 180),
  country: z.string().trim().min(2).max(100).optional().default('Nigeria'),
  postal_code: z.string().trim().max(20).optional(),
  delivery_notes: z.string().trim().max(240, 'Delivery notes must be at most 240 characters').optional(),
  is_default: z.boolean().optional().default(false),
};

export const createAddressSchema = z.object(addressFields).superRefine((input, context) => {
  if (!isValidNigeriaLga(input.state, input.lga)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lga'],
      message: 'Select a valid LGA for the selected state',
    });
  }
});

export const updateAddressSchema = z.object({
  label: addressFields.label,
  first_name: addressFields.first_name.optional(),
  last_name: addressFields.last_name.optional(),
  phone: addressFields.phone.optional(),
  street: addressFields.street.optional(),
  city: addressFields.city.optional(),
  state: addressFields.state.optional(),
  lga: addressFields.lga.optional(),
  area: addressFields.area.optional(),
  landmark: addressFields.landmark.optional(),
  country: z.string().trim().min(2).max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  delivery_notes: addressFields.delivery_notes,
  is_default: z.boolean().optional(),
}).superRefine((input, context) => {
  if (input.state && input.lga && !isValidNigeriaLga(input.state, input.lga)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lga'],
      message: 'Select a valid LGA for the selected state',
    });
  }
});

export const addressParamsSchema = z.object({
  addressId: z.string().cuid('Invalid address id'),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type AddressParamsInput = z.infer<typeof addressParamsSchema>;
