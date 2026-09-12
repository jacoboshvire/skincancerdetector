import { test, expect } from "@playwright/test";
import { signSessionToken, SESSION_COOKIE } from "../src/lib/auth";

// The dashboard the browser lands on after login is a real server component:
// it checks the session cookie itself (see src/lib/session.ts) and then
// fetches /api/scans + /api/profile, both of which need a real Postgres
// database. To exercise the actual login -> dashboard journey without one,
// the mocked /api/auth/login response sets a real, validly-signed session
// cookie (using the same JWT_SECRET the dev server is started with in
// playwright.config.ts), and the dashboard's own data fetches are mocked too.
test.beforeAll(() => {
  process.env.JWT_SECRET = "e2e-test-secret";
});

test.describe("Login page", () => {
  test("logging in without MFA lands on an authenticated dashboard", async ({ page, context }) => {
    // Pre-seed a valid session cookie rather than relying on the mocked
    // login response's Set-Cookie header racing the client-side navigation
    // that immediately follows it. The cookie itself is exercised by
    // protected-routes.spec.ts; this test is about the login form's own
    // success behavior.
    const token = signSessionToken({ userId: 1, email: "user@example.com" });
    await context.addCookies([{ name: SESSION_COOKIE, value: token, url: "http://localhost:3100" }]);

    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 200, json: { mfaRequired: false } });
    });
    await page.route("**/api/scans", async (route) => {
      await route.fulfill({ status: 200, json: { scans: [] } });
    });
    await page.route("**/api/profile", async (route) => {
      await route.fulfill({ status: 200, json: { profile: { fullName: null } } });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("correct-password");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  });

  test("logging in with MFA enabled routes to the verify-otp page", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 200, json: { mfaRequired: true, email: "user@example.com" } });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("correct-password");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/verify-otp\?email=user%40example\.com/);
    await expect(page.getByRole("heading", { name: "Enter verification code" })).toBeVisible();
  });

  test("shows an error and stays on the page for invalid credentials", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({ status: 401, json: { error: "Invalid email or password" } });
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows a 'just registered' message when arriving from sign-up", async ({ page }) => {
    await page.goto("/login?registered=1");
    await expect(page.getByText("Account created. Log in to continue.")).toBeVisible();
  });

  test("links to the register page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
