import { AxeBuilder } from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await expect(
      page.getByRole("button", { name: "Get started" }),
    ).toBeVisible();
  });

  test("should have a title", async ({ page }) => {
    await expect(page).toHaveTitle("Login • Element Admin");
  });

  test("should match screenshot", { tag: "@screenshot" }, async ({ page }) => {
    await expect(page).toHaveScreenshot();
  });

  test("should not have accessibility issues", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude("[data-floating-ui-portal]")
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
