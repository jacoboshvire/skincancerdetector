import { test, expect } from "@playwright/test";

test.describe("Protected routes", () => {
  test("visiting the dashboard while logged out redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("visiting the profile page while logged out redirects to login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting a scan page while logged out redirects to login", async ({ page }) => {
    await page.goto("/dashboard/scan");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a garbage session cookie is treated as logged out", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "session_token",
        value: "not-a-real-jwt",
        url: "http://127.0.0.1:3100",
      },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
