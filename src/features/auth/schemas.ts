import { z } from "zod";
import { ACTIVATION_CODE_LENGTH, normalizeActivationCode } from "./activation-code";

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt (used by Supabase Auth) ignores bytes beyond 72.
export const PASSWORD_MAX_LENGTH = 72;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/, "Informe um usuário válido.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
  .regex(/\p{L}/u, "A senha precisa ter pelo menos uma letra.")
  .regex(/\d/, "A senha precisa ter pelo menos um número.");

export const activationCodeSchema = z
  .string()
  .transform(normalizeActivationCode)
  .pipe(z.string().length(ACTIVATION_CODE_LENGTH, "O código tem 8 caracteres."));

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().max(PASSWORD_MAX_LENGTH),
});

export const activationCheckSchema = z.object({
  username: usernameSchema,
  code: activationCodeSchema,
});

export const activationCompleteSchema = activationCheckSchema
  .extend({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });
