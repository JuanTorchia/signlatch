import { expect, test } from "@playwright/test";

test("anonymous showcase is sanitized and has no effect controls", async ({ page }) => {
  const effectRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().includes("/_next/")) effectRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Sanitized real fixture")).toBeVisible();
  await expect(page.getByText("Public showcase is read-only")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to human approval" })).toHaveAttribute("href", "#fixture-approval-title");
  await expect(page.getByRole("link", { name: "Try the safe approval simulation" })).toHaveAttribute("href", "#demo");
  await expect(page.getByText("Two separate evidence tracks")).toBeVisible();
  await expect(page.getByText("Independently verified", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Prepare PDF/i })).toHaveCount(0);
  await expect(page.getByText("Private workspace access is not enabled in this deployment.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Sign in/i })).toHaveCount(0);
  expect(effectRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});
