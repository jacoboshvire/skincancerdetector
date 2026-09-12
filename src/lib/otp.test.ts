import { describe, expect, it } from "vitest";
import { generateOtpCode, hashOtp, verifyOtp, OTP_TTL_MS, MAX_OTP_ATTEMPTS } from "./otp";

describe("generateOtpCode", () => {
  it("always returns a 6-digit zero-padded string", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("produces varied codes across many calls", () => {
    const codes = new Set(Array.from({ length: 30 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashOtp / verifyOtp", () => {
  it("verifies a correct code against its hash", async () => {
    const hash = await hashOtp("123456");
    await expect(verifyOtp("123456", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect code", async () => {
    const hash = await hashOtp("123456");
    await expect(verifyOtp("654321", hash)).resolves.toBe(false);
  });

  it("hashes to something other than the plaintext code", async () => {
    const hash = await hashOtp("000000");
    expect(hash).not.toBe("000000");
  });
});

describe("constants", () => {
  it("has a 5 minute TTL", () => {
    expect(OTP_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("caps attempts at 5", () => {
    expect(MAX_OTP_ATTEMPTS).toBe(5);
  });
});
