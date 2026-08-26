import { expect, test } from "@playwright/test";

test("fresh fixture judge journey is reproducible well under ten minutes", async ({ page }) => {
  const started = Date.now();
  await page.goto("/");
  await expect(page.getByText("Sanitized fixture · zero SignLatch/provider effects")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mutate intent" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i }).check();
  await page.getByRole("button", { name: "Record simulated approval" }).click();
  await page.getByRole("button", { name: "Mutate intent" }).click();
  await expect(page.getByRole("status")).toContainText("Restoring values requires reapproval");
  await expect(page.getByText("no SignLatch provider-effect request, signing action, or credit use can originate here.", { exact: false })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(600_000);
});
