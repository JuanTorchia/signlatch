import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 320, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`fixture has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

test("fixture approval and invalidation are fully keyboard operable with visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const checkbox = page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i });
  await checkbox.focus();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  const approve = page.getByRole("button", { name: "Record simulated approval" });
  await approve.focus();
  const outline = await approve.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Fixture approval recorded locally");
  const mutation = page.getByRole("button", { name: "Change recipient email" });
  await expect(mutation).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("change recipient email");
  await expect(page.getByRole("button", { name: "Start a fresh fixture review" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(checkbox).toBeFocused();
});
