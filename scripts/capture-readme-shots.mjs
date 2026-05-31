// Renders chart stories from a running Storybook (http://localhost:6006) at
// specific theme / palette / visual-style combos and saves PNGs for the README
// gallery. Start Storybook first (`bun run storybook`), then:
//   node scripts/capture-readme-shots.mjs
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

const SB = "http://localhost:6006"
const OUT = resolve(import.meta.dirname, "../assets/readme")
mkdirSync(OUT, { recursive: true })

// Every shot is Outline style. theme x palette varies per the README layout.
const SHOTS = [
  { file: "candle-light-monochrome", id: "charts-candlechart--default", theme: "light", palette: "Monochrome" },
  { file: "candle-dark-monochrome", id: "charts-candlechart--default", theme: "dark", palette: "Monochrome" },
  { file: "candle-light-classic", id: "charts-candlechart--default", theme: "light", palette: "Classic" },
  { file: "candle-dark-classic", id: "charts-candlechart--default", theme: "dark", palette: "Classic" },
  { file: "treemap-dark-classic", id: "charts-treemapchart--default", theme: "dark", palette: "Classic" },
  { file: "heatmap-light-monochrome", id: "charts-heatmapchart--default", theme: "light", palette: "Monochrome" },
  { file: "depth-light-classic", id: "charts-depthchart--default", theme: "light", palette: "Classic" },
  { file: "line-dark-monochrome", id: "charts-linechart--default", theme: "dark", palette: "Monochrome" },
]

const VIEW = { width: 1200, height: 820 }
const PAD = 22

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 })
const page = await ctx.newPage()

for (const s of SHOTS) {
  const globals = `theme:${s.theme};visualStyle:Outline;palette:${s.palette};accents:off`
  const url = `${SB}/iframe.html?id=${s.id}&viewMode=story&globals=${globals}`
  await page.goto(url, { waitUntil: "load" })
  try {
    await page.waitForSelector("canvas", { timeout: 20000 })
  } catch {
    console.log("no canvas:", s.file, s.id)
    continue
  }
  // Let entry animation settle: wait until the first canvas stops changing.
  let prev = ""
  for (let i = 0; i < 40; i++) {
    const cur = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      return c ? c.toDataURL() : ""
    })
    if (cur && cur === prev) break
    prev = cur
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(350)
  const box = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")]
    if (!cs.length) return null
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const c of cs) {
      const r = c.getBoundingClientRect()
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top)
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom)
    }
    return { x0, y0, x1, y1 }
  })
  if (!box) { console.log("no canvas box:", s.file); continue }
  const x = Math.max(0, box.x0 - PAD)
  const y = Math.max(0, box.y0 - PAD)
  const clip = {
    x, y,
    width: Math.min((box.x1 - box.x0) + PAD * 2, VIEW.width - x),
    height: Math.min((box.y1 - box.y0) + PAD * 2, VIEW.height - y),
  }
  await page.screenshot({ path: `${OUT}/${s.file}.png`, clip })
  console.log("captured", s.file)
}

await browser.close()
console.log("done ->", OUT)
