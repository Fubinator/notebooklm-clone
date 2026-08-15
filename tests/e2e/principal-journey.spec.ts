import { expect, test } from "@playwright/test";

test("a fresh Guest asks a grounded Question and inspects its Citation", async ({
  context,
  page,
}) => {
  await expect(context.cookies()).resolves.toEqual([]);
  await page.goto("/");
  await expect(page.getByText("Example Notebook", { exact: true })).toBeVisible(
    {
      timeout: 30_000,
    },
  );

  const questionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/questions") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "What are the four AI RMF functions?" })
    .click();
  const response = await questionResponse;
  const responseBody = (await response.json()) as {
    category?: string;
    correlationId?: string;
    error?: string;
    result?: { kind?: string; status?: string };
  };
  const failureDetails = [
    responseBody.error,
    responseBody.category ? `category=${responseBody.category}` : undefined,
    responseBody.correlationId
      ? `correlationId=${responseBody.correlationId}`
      : undefined,
  ]
    .filter(Boolean)
    .join("; ");
  expect(
    response.status(),
    failureDetails || "The Question API did not complete successfully.",
  ).toBe(201);
  expect(responseBody.result).toEqual({
    kind: "grounded",
    status: "completed",
  });

  const citation = page.getByRole("button", { name: "Citation 1" });
  await expect(citation).toBeVisible({ timeout: 45_000 });
  await citation.click();

  const inspector = page.getByLabel("Citation 1 inspector");
  await expect(inspector).toContainText("AI RMF");
  await expect(inspector).toContainText("PDF page 20");
  await expect(inspector).toContainText(
    "The Core is composed of four functions: GOVERN, MAP, MEASURE, and MANAGE.",
  );
  await expect(inspector).toContainText(
    "This is the exact stored Passage validated for the Answer.",
  );
});
