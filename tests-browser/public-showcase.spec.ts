import { expect, test } from "@playwright/test";

test("anonymous showcase is sanitized and has no effect controls", async ({ page }) => {
  const effectRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().includes("/_next/")) effectRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByText("Sanitized fixture · zero external effects")).toBeVisible();
  await expect(page.getByText("Public showcase is read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: /Prepare PDF/i })).toHaveCount(0);
  await expect(page.getByText("Private workspace access is not enabled in this deployment.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/i })).toHaveCount(0);
  expect(effectRequests).toEqual([]);
});
