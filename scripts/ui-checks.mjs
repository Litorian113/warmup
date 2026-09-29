// Fast UI checks against the production build, with no voice sessions (no API cost):
// home ladder, briefing, microphone-denied message, unknown scene, unknown replay, metrics of a
// saved replay, mobile layout.
//
//   npm run build && node scripts/ui-checks.mjs
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 3104;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(import.meta.dirname, ".cache", "ui");
const CHROME = process.env.CHROME_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A talk saved by an older version, where AssemblyAI's utterances split the talk at a 2.5 s pause
// and the first answer at a 2 s pause. Rebuilt as turns: answers of 19 s and 17 s, two pauses.
function seededTalk() {
  const utt = (who, from, to, text) => {
    const ws = text.split(" ");
    const step = (to - from) / ws.length;
    const words = ws.map((w, i) => ({ text: w, start: Math.round(from + i * step), end: i === ws.length - 1 ? to : Math.round(from + (i + 1) * step - 80) }));
    return { who, start: from, end: to, text, words };
  };
  const talk = "Okay so the best advice I ever ignored was to start saving early because I thought I had plenty of time and it turns out I did not";
  const utterances = [
    utt("them", 500, 5000, "Hi, welcome up. I'm Priya, I'll be your host. Okay, your topic is: the best advice you've ever ignored."),
    utt("you", 6000, 30000, talk),
    utt("you", 32500, 60000, talk),
    utt("them", 62000, 70000, "Thank you. What would you tell someone starting their first job?"),
    utt("you", 71000, 80000, "I would tell them to automate it, so a little goes to savings"),
    utt("you", 82000, 90000, "before they ever see the money, because willpower runs out."),
    utt("them", 92000, 100000, "Last question: what advice are you ignoring right now?"),
    utt("you", 101000, 118000, "Probably to get more sleep. Everyone tells me, and I keep saying I will start next week."),
    utt("them", 120000, 125000, "Thank you, that was great."),
  ];
  const metrics = { youSeconds: 94, themSeconds: 26, talkShare: 0.78, avgGap: 1, longestGap: 1, wpm: 150, fillers: 0, fillersPerMin: 0, fillerWords: {}, tics: {}, questions: 0, longestTurn: 27.5, pauses: 0, longestPause: 0.1, overlaps: 0 };
  return {
    id: "sseeded",
    sceneId: "stage",
    personaName: "Priya",
    createdAt: Date.now(),
    durationSec: 126,
    sessionId: null,
    outcome: "wrapped-up",
    lines: [],
    points: [{ t: 10, value: 62, delta: 2, signals: [], said: "", kind: "tick" }, { t: 20, value: 66, delta: 4, signals: [], said: "", kind: "tick" }],
    startWarmth: 60,
    finalWarmth: 70,
    goals: {},
    topic: "The best advice you've ever ignored",
    talkSeconds: 54,
    qaStartedAt: 61,
    analysis: { transcriptId: "seeded", utterances, metrics },
    coach: { source: "llm", model: "seeded", headline: "A seeded replay", strengths: [], improvements: [], moments: [], nextStep: "Try again." },
  };
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore", detached: true });
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

try {
  await mkdir(OUT, { recursive: true });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {}
    await sleep(300);
  }
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: "networkidle" });
  const scenes = await page.locator(".scene").count();
  check("home lists all 7 scenes on the ladder", scenes === 7, `${scenes} scenes`);
  check("home has 5 rungs", (await page.locator(".rung").count()) === 5);

  await page.goto(`${BASE}/practice/first-date`, { waitUntil: "networkidle" });
  check("first date offers a choice of two dates", (await page.locator(".choice__opt").count()) === 2);
  await page.locator(".choice__opt").nth(1).click();
  check("choosing Theo updates the start panel", (await page.textContent(".brief__panel h2"))?.includes("Theo") ?? false);

  // microphone blocked
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  await page.goto(`${BASE}/practice/cafe`, { waitUntil: "networkidle" });
  check("level 1 scene shows hints by default", await page.locator(".toggle input").isChecked());
  await page.getByRole("button", { name: "Start talking" }).click();
  await page.waitForSelector(".notice", { timeout: 10000 }).catch(() => {});
  const notice = (await page.textContent(".notice").catch(() => "")) ?? "";
  check("blocked microphone shows how to fix it", /Microphone access is blocked/.test(notice), notice.slice(0, 60));
  check("start button is usable again after the error", await page.getByRole("button", { name: "Start talking" }).isEnabled());

  const res = await page.goto(`${BASE}/practice/nope`);
  check("unknown scene returns 404", res?.status() === 404);
  check("404 page offers a way back", (await page.getByRole("link", { name: "Choose a scene" }).count()) === 1);

  await page.goto(`${BASE}/report/does-not-exist`, { waitUntil: "networkidle" });
  check("unknown replay explains itself", (await page.textContent("h1"))?.includes("isn’t on this device") ?? false);

  await page.evaluate((rec) => localStorage.setItem("warmup.sessions.v1", JSON.stringify([rec])), seededTalk());
  await page.goto(`${BASE}/report/sseeded`, { waitUntil: "networkidle" });
  await page.waitForSelector(".tile", { timeout: 10000 }).catch(() => {});
  const tile = (label) =>
    page.evaluate((l) => [...document.querySelectorAll(".tile")].find((t) => t.querySelector(".tile__label")?.textContent === l)?.innerText.replace(/\s+/g, " ") ?? "", label);
  const qa = await tile("Average Q&A answer");
  check("Q&A answers are measured whole, across pauses", /18 ?sec/.test(qa) && /Well sized/.test(qa), qa.slice(0, 60));
  const pause = await tile("Longest pause mid-sentence");
  check("pauses where AssemblyAI split an utterance still count", /2\.5 ?sec/.test(pause) && /2 pauses/.test(pause), pause.slice(0, 70));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("warmup.sessions.v1") ?? "[]")[0]?.analysis);
  check("the rebuilt analysis is saved", saved?.v === 2 && saved.utterances.filter((u) => u.who === "you").length === 3, `v=${saved?.v}`);
  await page.evaluate(() => localStorage.removeItem("warmup.sessions.v1"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("home has no horizontal scroll on a phone", overflow <= 0, `${overflow}px`);
  await page.goto(`${BASE}/practice/party`, { waitUntil: "networkidle" });
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("briefing has no horizontal scroll on a phone", overflow2 <= 0, `${overflow2}px`);
  await page.screenshot({ path: path.join(OUT, "brief-mobile.png"), fullPage: true });

  check("no uncaught page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await browser.close();
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
process.exit(failed ? 1 : 0);
