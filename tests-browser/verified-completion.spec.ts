import { expect, test } from "@playwright/test";

test("public fixture never presents simulated provider completion as verified", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("fixture-demonstrated", { exact: false })).toBeVisible();
  await expect(page.getByText("verified complete", { exact: false })).toHaveCount(0);

  const forgedSignature = Buffer.alloc(32).toString("base64");
  const forged = await page.request.post(
    `/api/webhooks/foxit-esign?signature=${encodeURIComponent(forgedSignature)}`,
    { data: { event_name: "folder_executed", event_date: Date.now(), data: { folder: { folderId: "forged" } } } },
  );
  expect([401, 503]).toContain(forged.status());
});
