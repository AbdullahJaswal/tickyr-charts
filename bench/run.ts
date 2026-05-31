// Tinybench 6 entry point. Runs every workload registered via
// `registerBench` and writes results to bench-results/pr.json for the CI
// gate to compare against bench-results/main.json (committed on the
// long-lived `bench-results` orphan branch).
//
// New workloads land alongside their feature (e.g.,
// bench/draw-1000-bars.bench.ts under Phase 1).

import { Bench } from "tinybench"
import { mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = join(__dirname, "..", "bench-results")

type WorkloadFn = (bench: Bench) => void | Promise<void>
const workloads: { name: string; fn: WorkloadFn }[] = []

export function registerBench(name: string, fn: WorkloadFn): void {
  workloads.push({ name, fn })
}

async function discoverWorkloads(): Promise<void> {
  const entries = await readdir(__dirname, { withFileTypes: true })
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith(".bench.ts")) {
      await import(pathToFileURL(join(__dirname, e.name)).href)
    }
  }
}

async function main(): Promise<void> {
  await discoverWorkloads()

  if (workloads.length === 0) {
    console.log("No bench workloads registered yet.")
    return
  }

  const bench = new Bench({ time: 1000, warmupTime: 200, throws: true })
  for (const { fn } of workloads) await fn(bench)
  await bench.run()

  const results = bench.tasks.map((t) => {
    const r = t.result
    if (
      r &&
      (r.state === "completed" || r.state === "aborted-with-statistics")
    ) {
      return {
        name: t.name,
        state: r.state,
        period_ms: r.period,
        latency_mean_ms: r.latency.mean,
        latency_p50_ms: r.latency.p50,
        latency_p99_ms: r.latency.p99,
        samples: r.latency.samplesCount,
        hz: r.throughput.mean,
      }
    }
    return { name: t.name, state: r?.state ?? "unknown" }
  })

  await mkdir(RESULTS_DIR, { recursive: true })
  await writeFile(
    join(RESULTS_DIR, "pr.json"),
    JSON.stringify({ when: new Date().toISOString(), results }, null, 2),
  )

  console.table(results)
}

await main()
