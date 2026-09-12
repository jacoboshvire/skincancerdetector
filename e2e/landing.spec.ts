import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads and shows the core pitch", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SkinScan/i);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("effortless");
    await expect(
      page.getByText("SkinScan is an educational demonstration", { exact: false })
    ).toBeVisible();
  });

  test("nav 'Log in' link goes to the login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Log in" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("'Get started' link goes to the register page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  });
});
