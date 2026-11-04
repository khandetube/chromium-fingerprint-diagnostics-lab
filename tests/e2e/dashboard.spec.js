import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("dashboard boots without uncaught browser errors", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Understand your browser/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Run diagnostics/ })).toBeEnabled();
  await expect(page.locator("#overall-status")).toHaveText("Ready to test");
  expect(pageErrors).toEqual([]);
});

test("diagnostics run, persist a snapshot, and export valid JSON", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Run diagnostics/ }).click();

  await expect(page.locator("#overall-status")).toHaveText(/\d+ \/ \d+ modules available/, { timeout: 25_000 });
  await expect(page.locator("#run-summary")).toContainText("Run ID");
  await expect(page.locator("#history-list .history-item")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Export JSON/ })).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^diagnostics-.+\.json$/);

  const filePath = await download.path();
  const snapshot = JSON.parse(await readFile(filePath, "utf8"));
  expect(snapshot.schemaVersion).toBe(3);
  expect(snapshot.results).toHaveProperty("gpuRendering");
  expect(snapshot.results).toHaveProperty("compatibility");
  expect(snapshot.results).toHaveProperty("contextLifecycle");
  expect(snapshot.timestamp).toBeTruthy();

  await expect(page.getByRole("button", { name: /Export CSV/ })).toBeEnabled();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  const csvDownload = await csvPromise;
  expect(csvDownload.suggestedFilename()).toMatch(/^diagnostics-.+\.csv$/);
  const csvText = await readFile(await csvDownload.path(), "utf8");
  expect(csvText.replace(/^\\uFEFF/, "")).toContain('"snapshot_id","timestamp","module","available","digest","reason"');
  expect(csvText).toContain("gpuRendering");
  await expect(page.getByRole("button", { name: /Export HTML/ })).toBeEnabled();
  const htmlPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export HTML/ }).click();
  const htmlDownload = await htmlPromise;
  expect(htmlDownload.suggestedFilename()).toMatch(/^diagnostics-.+\\.html$/);
  const reportHtml = await readFile(await htmlDownload.path(), "utf8");
  expect(reportHtml).toContain("Diagnostics evidence report");
  expect(reportHtml).toContain("GPU rendering");
  expect(reportHtml).toContain("non-cryptographic comparison checksums");
});

test("valid snapshot import succeeds and malformed JSON is rejected", async ({ page }) => {
  await page.goto("/");
  const snapshot = {
    schemaVersion: 3,
    id: "browser-e2e-import",
    timestamp: new Date().toISOString(),
    environment: {},
    probes: {},
    results: Object.fromEntries(
      ["canvas", "webgl", "audio", "environment", "benchmark", "gpuRendering", "compatibility", "contextLifecycle"]
        .map(key => [key, { available: false, digest: null, reason: "fixture" }])
    )
  };

  await page.locator("#import-file").setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(snapshot))
  });
  await expect(page.locator("#overall-status")).toHaveText("Imported snapshot successfully");
  await expect(page.locator("#run-summary")).toContainText("browser-e2e-import");

  await page.locator("#import-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ definitely not json")
  });
  await expect(page.locator("#overall-status")).toContainText("Import failed:");
});
