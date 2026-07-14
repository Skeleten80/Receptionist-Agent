import { test, expect } from "@playwright/test";

test("marketing home renders value proposition", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Never miss another customer call/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start trial/i }).first()).toBeVisible();
});

test("login page is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Log in to LocalAgent/i })).toBeVisible();
});
