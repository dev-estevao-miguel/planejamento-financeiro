import { describe, expect, it } from "vitest";
import {
  ACTIVATION_CODE_LENGTH,
  formatActivationCode,
  generateActivationCode,
  normalizeActivationCode,
} from "./activation-code";
import { safeRedirectPath } from "./safe-redirect";
import { activationCompleteSchema, loginSchema, passwordSchema } from "./schemas";

describe("activation codes", () => {
  it("generates unambiguous codes of the expected length", () => {
    const codes = new Set(Array.from({ length: 200 }, generateActivationCode));
    for (const code of codes) {
      expect(code).toMatch(new RegExp(`^[A-HJKMNP-Z2-9]{${ACTIVATION_CODE_LENGTH}}$`));
    }
    expect(codes.size).toBe(200);
  });

  it("normalizes what people type", () => {
    expect(normalizeActivationCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(formatActivationCode("abcd2345")).toBe("ABCD-2345");
  });
});

describe("auth schemas", () => {
  it("normalizes the username", () => {
    expect(loginSchema.parse({ username: "  Marido ", password: "" }).username).toBe("marido");
  });

  it.each([
    ["curta1", false],
    ["somenteletras", false],
    ["12345678", false],
    ["senhaBoa2026", true],
    ["çãoÁrvore9", true],
  ])("password %s valid=%s", (password, valid) => {
    expect(passwordSchema.safeParse(password).success).toBe(valid);
  });

  it("requires matching passwords and a well-formed code", () => {
    const result = activationCompleteSchema.safeParse({
      username: "esposa",
      code: "abcd-2345",
      password: "senhaBoa2026",
      confirmPassword: "senhaBoa2025",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
});

describe("safeRedirectPath", () => {
  it.each([
    ["/movimentacoes?mes=2026-10", "/movimentacoes?mes=2026-10"],
    ["https://evil.example", "/"],
    ["//evil.example/x", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    [undefined, "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
