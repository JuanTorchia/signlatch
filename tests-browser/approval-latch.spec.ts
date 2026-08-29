import { expect, test } from "@playwright/test";

test("accessible fixture ceremony demonstrates approval and mutation denial", async ({ page }) => {
  const effectRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().includes("/_next/")) effectRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Try the exact approval latch" })).toBeVisible();
  await expect(page.getByLabel("Fixture ceremony state")).toContainText("Review required");
  await expect(page.getByLabel("Fixture ceremony state")).toContainText("Provider stateLockedZero SignLatch/provider effects");
  const approve = page.getByRole("button", { name: "Record simulated approval" });
  await expect(approve).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i }).check();
  await approve.click();
  await expect(page.getByRole("status")).toContainText("Fixture approval recorded locally");
  await expect(page.getByLabel("Fixture ceremony state")).toContainText("Simulated approval");
  await expect(page.getByLabel("Fixture ceremony state")).toContainText("Provider stateLockedZero SignLatch/provider effects");
  await page.getByRole("button", { name: "Change recipient email" }).click();
  await expect(page.getByRole("status")).toContainText("Approval invalidated because change recipient email");
  await expect(page.getByRole("status")).toContainText("requires a fresh approval");
  await expect(approve).toBeDisabled();
  await expect(page.getByLabel("Fixture ceremony state")).toContainText("Approval invalidated");
  expect(effectRequests).toEqual([]);
});

for (const mutation of ["Replace document version", "Change recipient email", "Move signature field", "Add policy warning", "Change payment terms"]) {
  test(`${mutation} invalidates approval and recovery starts clean`, async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: mutation })).toBeDisabled();
  await page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i }).check();
    await page.getByRole("button", { name: "Record simulated approval" }).click();
    await page.getByRole("button", { name: mutation }).click();
    await expect(page.getByRole("status")).toContainText("Approval invalidated because");
    await page.getByRole("button", { name: "Start a fresh fixture review" }).click();
    await expect(page.getByRole("status")).toHaveText("Exact fixture is ready for human review.");
    await expect(page.getByRole("checkbox", { name: /I reviewed the exact fixture snapshot/i })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Record simulated approval" })).toBeDisabled();
  });
}
