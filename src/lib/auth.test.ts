import { describe, expect, it, beforeAll } from "vitest";
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken, SESSION_COOKIE } from "./auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-unit-tests";
});

describe("hashPassword / verifyPassword", () => {
  it("hashes a password to something other than the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("hunter2", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
  });
});

describe("signSessionToken / verifySessionToken", () => {
  it("round-trips a valid payload", () => {
    const token = signSessionToken({ userId: 42, email: "user@example.com" });
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(42);
    expect(payload?.email).toBe("user@example.com");
  });

  it("rejects a garbage token", () => {
    expect(verifySessionToken("not-a-real-token")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSessionToken({ userId: 1, email: "a@b.com" });
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "a-different-secret";
    try {
      expect(verifySessionToken(token)).toBeNull();
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("exports the expected session cookie name", () => {
    expect(SESSION_COOKIE).toBe("session_token");
  });
});
