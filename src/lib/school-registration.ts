import { z } from 'zod';

export const schoolRegistrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter the school name.').max(200),
  code: z.string().trim().toUpperCase().min(2, 'Enter or generate a school code.').max(40).regex(/^[A-Z0-9-]+$/, 'Use letters, numbers and hyphens for the school code.'),
  address: z.string().trim().max(1000),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(''), z.string().trim().email()]),
  motto: z.string().trim().max(500),
  current_session: z.string().trim().min(1, 'Enter the academic session.').max(40),
});