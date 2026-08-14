import { expect, test } from "@playwright/test";

test("a fresh Guest asks a grounded Question and inspects its Citation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Example Notebook", { exact: true })).toBeVisible(
    {
      timeout: 30_000,
    },
  );

  await page
    .getByRole("button", { name: "What makes an AI system trustworthy?" })
    .click();
  const citation = page.getByRole("button", { name: "Citation 1" });
  await expect(citation).toBeVisible({ timeout: 45_000 });
  await citation.click();

  await expect(page.getByLabel("Citation 1 inspector")).toContainText("AI RMF");
});
