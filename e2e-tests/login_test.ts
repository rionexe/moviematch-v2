import { Page } from "https://raw.githubusercontent.com/lucacasonato/deno-puppeteer/main/mod.ts";
import { assertNotEquals } from "/deps.ts";
import {
  browserTest,
  getScreenshotOptions,
  selector,
  textInputSelector,
} from "./_utils.ts";

// There is no separate sign-in screen anymore: the app opens on the Join/Create
// (RoomEntry) screen, where the name is entered and login is sent implicitly on
// submit. This just fills the name and confirms RoomEntry rendered.
export const loginAnonymous = async (page: Page, userName: string) => {
  await page.waitForSelector(textInputSelector("given-name"));
  await page.type(textInputSelector("given-name"), userName);
  await page.waitForSelector(selector("mode-create"));
  assertNotEquals(await page.$(selector("mode-create")), null);
};

browserTest("Login - Anonymous", async (page: Page, emulatedName?: string) => {
  await page.screenshot(
    getScreenshotOptions(`login_page_${emulatedName ?? "desktop"}`),
  );
  await loginAnonymous(page, "Luke");
});
