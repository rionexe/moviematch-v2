// Headless test of the swipe deck against the mock harness (no Plex/server).
// Run: LD_LIBRARY_PATH=~/.cache/puppeteer-libs deno run -A --unstable cardstack-mock-test.ts
import puppeteer from "https://raw.githubusercontent.com/lucacasonato/deno-puppeteer/main/mod.ts";
import { serveDir } from "https://deno.land/std@0.210.0/http/file_server.ts";

const ROOT = "/projects/programming/moviematch-v2/web/app/build";
const SHOTS = "/projects/programming/moviematch-v2/screenshots";
const PORT = 8911;

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
await page.goto(`http://localhost:${PORT}/cardstack-mock.html`, {
  waitUntil: "networkidle0",
});
await page.waitForSelector('[data-front="true"]', { timeout: 10000 });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dismissed = () =>
  page.$eval("#status", (e) => Number(e.getAttribute("data-dismissed-count")));

const frontState = () =>
  page.evaluate(() => {
    const fronts = [...document.querySelectorAll('[data-front="true"]')];
    const all = [...document.querySelectorAll("[data-index]")];
    const interactive = all.filter((el) =>
      getComputedStyle(el).pointerEvents !== "none"
    );
    const f = fronts[0] as HTMLElement | undefined;
    let dx = NaN;
    if (f) {
      const r = f.getBoundingClientRect();
      dx = (r.left + r.width / 2) - window.innerWidth / 2;
    }
    return {
      fronts: fronts.length,
      interactive: interactive.length,
      frontPE: f ? getComputedStyle(f).pointerEvents : "none",
      dx,
    };
  });

const waitDismiss = async (before: number) => {
  for (let t = 0; t < 30; t++) {
    if (await dismissed() > before) return await dismissed();
    await sleep(100);
  }
  return await dismissed();
};

// Wait until the front card has settled at centre (its enter animation finished),
// so a rapid rate isn't dropped by the `springs.x.idle` guard.
const waitSettled = async () => {
  for (let t = 0; t < 25; t++) {
    const s = await frontState();
    if (s.fronts === 1 && Math.abs(s.dx) < 5) return;
    await sleep(100);
  }
};

await page.screenshot({ path: `${SHOTS}/cardstack_deck.png` }).catch(() => {});

// Test A — state machine + render invariant via keyboard rating.
// Rapid rating — no settle wait before each press, to exercise dropping rates
// while the incoming front card is still animating into place.
for (let i = 1; i <= 5; i++) {
  const before = await dismissed();
  await page.keyboard.press(i % 2 ? "ArrowRight" : "ArrowLeft");
  const after = await waitDismiss(before);
  check(after === before + 1, `rapid keyboard dismissal ${i}: ${before} -> ${after}`);
  await waitSettled();
  const s = await frontState();
  check(s.fronts === 1, `  exactly one front card (got ${s.fronts})`);
  check(s.interactive === 1, `  exactly one interactive card (got ${s.interactive})`);
  check(s.frontPE === "auto", `  front pointer-events auto (got ${s.frontPE})`);
  check(Math.abs(s.dx) < 80, `  front card centered (dx=${Math.round(s.dx)})`);
}

// Test B — consecutive REAL drag swipes (the actual stuck scenario).
for (let i = 1; i <= 3; i++) {
  await waitSettled();
  const before = await dismissed();
  const f = await page.$('[data-front="true"]');
  const box = await f!.boundingBox();
  check(!!box, `drag ${i}: front card has a box`);
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let s = 1; s <= 14; s++) {
      await page.mouse.move(cx + (s * 720) / 14, cy);
      await sleep(8);
    }
    await page.mouse.up();
    // Immediately (within the ~150ms swipe-off window, before finalize): the
    // card now at the front must ALREADY be the single interactive, centered one.
    // This is the discriminating check for the "stuck" bug.
    const mid = await frontState();
    check(
      mid.fronts === 1 && mid.frontPE === "auto" && Math.abs(mid.dx) < 80,
      `drag ${i}: next card interactive mid-swipe (fronts=${mid.fronts} pe=${mid.frontPE} dx=${Math.round(mid.dx)})`,
    );
    const after = await waitDismiss(before);
    check(after === before + 1, `drag ${i}: swipe dismissed a card (${before} -> ${after})`);
    await sleep(300);
  }
}

await browser.close();
ac.abort();
await server.finished.catch(() => {});

console.log("\n=== CardStack headless test ===");
console.log(log.join("\n"));
console.log(`\nRESULT: ${failed ? "FAIL" : "PASS"}`);
Deno.exit(failed ? 1 : 0);
