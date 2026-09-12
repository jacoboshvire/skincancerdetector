import { test, expect } from "@playwright/test";

test.describe("Verify OTP page", () => {
  test("shows the email the code was sent to", async ({ page }) => {
    await page.goto("/verify-otp?email=user%40example.com");
    await expect(page.getByText("user@example.com")).toBeVisible();
  });

  test("verify button is disabled until 6 digits are entered", async ({ page }) => {
    await page.goto("/verify-otp?email=user%40example.com");
    const verifyButton = page.getByRole("button", { name: "Verify" });
    await expect(verifyButton).toBeDisabled();

    await page.getByLabel("Verification code").fill("123");
    await expect(verifyButton).toBeDisabled();

    await page.getByLabel("Verification code").fill("123456");
    await expect(verifyButton).toBeEnabled();
  });

  test("strips non-numeric characters from the code input", async ({ page }) => {
    await page.goto("/verify-otp?email=user%40example.com");
    // The input also has maxLength=6, so keep the raw fill within that or
    // the browser truncates before React gets a chance to strip letters.
    await page.getByLabel("Verification code").fill("1a2b3c");
    await expect(page.getByLabel("Verification code")).toHaveValue("123");
  });

  test("a correct code redirects to the dashboard flow", async ({ page }) => {
    await page.route("**/api/auth/verify-otp", async (route) => {
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto("/verify-otp?email=user%40example.com");
    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();
    // No real session cookie is set by the mock, so the dashboard's own auth
    // guard bounces back to /login — this confirms the OTP form itself
    // navigated onward instead of staying put with an error.
    await expect(page).toHaveURL(/\/(dashboard|login)/);
  });

  test("shows an error for an incorrect code and stays on the page", async ({ page }) => {
    await page.route("**/api/auth/verify-otp", async (route) => {
      await route.fulfill({ status: 400, json: { error: "Invalid or expired code" } });
    });
    await page.goto("/verify-otp?email=user%40example.com");
    await page.getByLabel("Verification code").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByText("Invalid or expired code")).toBeVisible();
    await expect(page).toHaveURL(/\/verify-otp/);
  });

  test("resend code shows a confirmation message", async ({ page }) => {
    await page.route("**/api/auth/resend-otp", async (route) => {
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto("/verify-otp?email=user%40example.com");
    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByText("A new code has been sent.")).toBeVisible();
  });
});
