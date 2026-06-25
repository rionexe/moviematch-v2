// Headless test of the matches carousel wheel-scroll against the mock harness.
// Run: LD_LIBRARY_PATH=~/.cache/puppeteer-libs deno run -A --unstable matches-mock-test.ts
import puppeteer from "https://raw.githubusercontent.com/lucacasonato/deno-puppeteer/main/mod.ts";
import { serveDir } from "https://deno.land/std@0.210.0/http/file_server.ts";

const ROOT = "/projects/programming/moviematch-v2/web/app/build";
const SHOTS = "/projects/programming/moviematch-v2/screenshots";
const PORT = 8912;

const ac = new AbortController();
const server = Deno.serve(
  { port: PORT, signal: ac.signal, onListen() {} },
  (req) => serveDir(req, { fsRoot: ROOT, quiet: true }),
);

const log: string[] = [];
let failed = false;
const check = (cond: boolean, msg: string) => {
  log.push(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failed = true;
};

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(`http://localhost:${PORT}/matches-mock.html`, {
  waitUntil: "networkidle0",
});
await page.waitForSelector("#app ul");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const scrollLeft = () => page.$eval("#app ul", (e) => (e as HTMLElement).scrollLeft);
const overflow = () =>
  page.$eval("#app ul", (e) => e.scrollWidth > (e as HTMLElement).clientWidth);

check(await overflow(), "matches list overflows horizontally (scrollable)");

// Position the mouse over the carousel and wheel down a few notches.
const box = await (await page.$("#app ul"))!.boundingBox();
await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

const start = await scrollLeft();
for (let i = 0; i < 3; i++) {
  await page.mouse.wheel({ deltaY: 120 });
  await sleep(450); // allow the smooth scroll + snap to settle
}
const afterDown = await scrollLeft();
check(afterDown > start + 50, `wheel down scrolls right (left ${start} -> ${afterDown})`);

// Wheel back up.
for (let i = 0; i < 2; i++) {
  await page.mouse.wheel({ deltaY: -120 });
  await sleep(450);
}
const afterUp = await scrollLeft();
check(afterUp < afterDown - 50, `wheel up scrolls left (left ${afterDown} -> ${afterUp})`);

await page.screenshot({ path: `${SHOTS}/matches_carousel.png` }).catch(() => {});

await browser.close();
ac.abort();
await server.finished.catch(() => {});

console.log("\n=== Matches carousel headless test ===");
console.log(log.join("\n"));
console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
Deno.exit(failed ? 1 : 0);
