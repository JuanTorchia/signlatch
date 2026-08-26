import { expect, test } from "@playwright/test";

test("accessible fixture ceremony demonstrates approval and mutation denial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Try the exact approval latch" })).toBeVisible();
  const approve = page.getByRole("button", { name: /Approve exact fixture/ });
  await expect(approve).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i }).check();
  await approve.click();
  await expect(page.getByRole("status")).toContainText("Fixture approval recorded locally");
  await page.getByRole("button", { name: "Start a fresh fixture review" }).click();
  await page.getByRole("button", { name: "Mutate recipient" }).click();
  await expect(page.getByRole("status")).toContainText("Approval invalidated by recipient mutation");
  await expect(page.getByRole("status")).toContainText("Restoring values requires reapproval");
  await expect(approve).toBeDisabled();
});
