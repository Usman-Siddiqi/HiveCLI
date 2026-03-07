import { mkdir } from "node:fs/promises";

import { chromium } from "playwright";

const TARGET_URL = process.env.HIVECLI_UI_URL ?? "http://127.0.0.1:1420";
const SCREENSHOT_DIR = ".hivecli";
const SCREENSHOT_PATH = `${SCREENSHOT_DIR}/playwright-smoke.png`;
const PROMPT = 'Reply with exactly "OK" and nothing else.';
const PANEL_NAMES = ["worker-a", "worker-b", "judge", "implementer"];

async function readStatuses(page) {
  const statuses = {};

  for (const name of PANEL_NAMES) {
    const locator = page.getByTestId(`status-${name}`);
    statuses[name] = (await locator.textContent())?.trim().toLowerCase() ?? "missing";
  }

  return statuses;
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.getByTestId("prompt-input").waitFor({ state: "visible" });

    const prompt = page.getByTestId("prompt-input");
    await prompt.fill(PROMPT);
    await page.getByTestId("prompt-send").click();

    await page.getByTestId("status-worker-a").filter({ hasText: /running|completed/i }).waitFor({ timeout: 30000 });
    await page.getByTestId("status-worker-b").filter({ hasText: /running|completed/i }).waitFor({ timeout: 30000 });

    const deadline = Date.now() + 180000;
    let finalStatuses = await readStatuses(page);

    while (Date.now() < deadline) {
      finalStatuses = await readStatuses(page);
      const values = Object.values(finalStatuses);

      if (values.includes("failed")) {
        throw new Error(`A panel failed: ${JSON.stringify(finalStatuses)}`);
      }

      if (values.every((value) => value.includes("completed"))) {
        break;
      }

      await page.waitForTimeout(1500);
    }

    if (!Object.values(finalStatuses).every((value) => value.includes("completed"))) {
      throw new Error(`Timed out waiting for completion: ${JSON.stringify(finalStatuses)}`);
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    console.log(`Playwright smoke passed: ${JSON.stringify(finalStatuses)}`);
    console.log(`Screenshot: ${SCREENSHOT_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
