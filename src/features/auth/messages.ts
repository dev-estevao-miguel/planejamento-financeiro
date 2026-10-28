/** User-facing auth messages (pt-BR). Deliberately generic: they never reveal
 *  whether a username exists or why exactly a credential was rejected. */
export const AUTH_MESSAGES = {
  invalidCredentials: "Usuário ou senha inválidos.",
  invalidActivation: "Usuário ou código inválido, expirado ou já utilizado.",
  tooManyAttempts: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  unavailable: "Não foi possível concluir agora. Tente novamente em instantes.",
  weakPassword: "Essa senha é fraca demais. Escolha outra.",
} as const;

export type AuthField = "username" | "password" | "code" | "confirmPassword";

export interface AuthFormState {
  status: "idle" | "error" | "code_verified";
  message?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  /** Echoed back so the form keeps what the person typed (never the password). */
  username?: string;
  code?: string;
}

export const INITIAL_AUTH_STATE: AuthFormState = { status: "idle" };
