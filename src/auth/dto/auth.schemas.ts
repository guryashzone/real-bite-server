import { z } from 'zod';
import { PASSWORD_BLOCKLIST, PASSWORD_MIN_LENGTH } from '../auth.constants.js';

const email = z.email().trim().toLowerCase().max(254);

const displayName = z.string().trim().min(1).max(80);

const password = z
  .string()
  .trim()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200)
  .refine((value) => !PASSWORD_BLOCKLIST.has(value.toLowerCase()), 'Password is too common');

const sixDigitCode = z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits');

export const googleSignInBody = z.strictObject({
  idToken: z.string().trim().min(1).max(4096),
});
export type GoogleSignInBody = z.infer<typeof googleSignInBody>;

export const registerBody = z.strictObject({ email, password, displayName });
export type RegisterBody = z.infer<typeof registerBody>;

export const verifyEmailBody = z.strictObject({ email, code: sixDigitCode });
export type VerifyEmailBody = z.infer<typeof verifyEmailBody>;

export const resendVerificationBody = z.strictObject({ email });
export type ResendVerificationBody = z.infer<typeof resendVerificationBody>;

export const loginBody = z.strictObject({ email, password: z.string().trim().min(1).max(200) });
export type LoginBody = z.infer<typeof loginBody>;

export const refreshBody = z.strictObject({ refreshToken: z.string().trim().min(1).max(512) });
export type RefreshBody = z.infer<typeof refreshBody>;

export const logoutQuery = z.strictObject({
  all: z.stringbool().default(false),
});
export type LogoutQuery = z.infer<typeof logoutQuery>;

export const forgotPasswordBody = z.strictObject({ email });
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBody>;

export const resetPasswordBody = z.strictObject({ email, code: sixDigitCode, newPassword: password });
export type ResetPasswordBody = z.infer<typeof resetPasswordBody>;

export const changePasswordBody = z.strictObject({
  currentPassword: z.string().trim().min(1).max(200).optional(),
  newPassword: password,
});
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;
