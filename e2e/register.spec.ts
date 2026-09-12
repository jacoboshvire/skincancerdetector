import { test, expect } from "@playwright/test";

// The register form talks to /api/auth/register, which needs a real Postgres
// database. These tests mock that endpoint so the user-facing flow (the
// thing a person actually experiences) can be exercised in any environment.

test.describe("Register page", () => {
  test("requires email and password before submitting", async ({ page }) => {
    await page.goto("/register");
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  test("successful registration redirects to login with a confirmation message", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    await page.goto("/register");
    await page.getByLabel("Email").fill("new.user@example.com");
    await page.getByLabel("Password").fill("a-strong-password");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL(/\/login\?registered=1/);
    await expect(page.getByText("Account created. Log in to continue.")).toBeVisible();
  });

  test("shows the server's error message when registration fails", async ({ page }) => {
    await page.route("**/api/auth/register", async (route) => {
      await route.fulfill({ status: 409, json: { error: "Email already registered" } });
    });

    await page.goto("/register");
    await page.getByLabel("Email").fill("existing.user@example.com");
    await page.getByLabel("Password").fill("a-strong-password");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByText("Email already registered")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});
