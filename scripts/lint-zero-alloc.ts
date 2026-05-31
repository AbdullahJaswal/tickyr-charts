#!/usr/bin/env bun
// Zero-alloc contract linter.
//
// Scans `src/` for functions whose preceding JSDoc contains `@ZeroAlloc`
// and reports forbidden patterns inside their bodies:
//   - Template strings (backtick string literals)
//   - `new ` (object construction)
//   - `.map(`, `.filter(`, `.reduce(`, `.forEach(` (allocating iterators)
//   - `for (... of ...)` (allocating iterator object)
//   - `JSON.parse` / `JSON.stringify`
//   - `Object.keys` / `Object.entries` / `Object.values`
//   - ` instanceof `
//   - `Array.from`
//   - `[...` and `{ ...` (spread allocations)
//
// Per PRINCIPLES.md #12 Zero-Allocation Fast Paths. Tag functions with
// `@ZeroAlloc` in their preceding JSDoc to opt them into this scan.
// Exits non-zero on any violation so it can plug into CI.

import { readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { Glob } from "bun"

interface Violation {
  file: string
  line: number
  fn: string
  pattern: string
  snippet: string
}

const FORBIDDEN: { pattern: RegExp; name: string }[] = [
  { pattern: /`[^`]*\$\{/, name: "template-string" },
  { pattern: /\bnew\s+\w/, name: "new" },
  { pattern: /\.(map|filter|reduce|forEach)\s*\(/, name: "array-iter-method" },
  { pattern: /\bfor\s*\(\s*(const|let|var)\s+\w+\s+of\s+/, name: "for-of" },
  { pattern: /\bJSON\.(parse|stringify)\b/, name: "JSON" },
  { pattern: /\bObject\.(keys|entries|values)\b/, name: "Object.iter" },
  { pattern: /\binstanceof\b/, name: "instanceof" },
  { pattern: /\bArray\.from\b/, name: "Array.from" },
  { pattern: /\[\s*\.\.\./, name: "array-spread" },
  { pattern: /\{\s*\.\.\./, name: "object-spread" },
]

/** Walk a function body starting just after the opening `{`. Tracks
 *  brace balance to find the matching close `}`. */
function findFunctionEnd(src: string, startOfBody: number): number {
  let depth = 1
  let i = startOfBody
  while (i < src.length && depth > 0) {
    const c = src[i]!
    if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === "/") {
      // Skip // and /* */ comments
      const next = src[i + 1]
      if (next === "/") {
        while (i < src.length && src[i] !== "\n") i++
        continue
      }
      if (next === "*") {
        i += 2
        while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/"))
          i++
        i += 2
        continue
      }
    } else if (c === '"' || c === "'") {
      // Skip string literals (so '{' inside strings doesn't confuse us)
      const quote = c
      i++
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++
        i++
      }
    } else if (c === "`") {
      // Skip template literals
      i++
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") {
          i += 2
          continue
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          // Nested expression - recurse on braces
          let inner = 1
          i += 2
          while (i < src.length && inner > 0) {
            if (src[i] === "{") inner++
            else if (src[i] === "}") inner--
            i++
          }
          continue
        }
        i++
      }
    }
    i++
  }
  return i - 1 // position of the matching `}`
}

function lineOf(src: string, pos: number): number {
  let n = 1
  for (let i = 0; i < pos; i++) if (src[i] === "\n") n++
  return n
}

function lintFile(path: string): Violation[] {
  const src = readFileSync(path, "utf-8")
  const violations: Violation[] = []
  // Look for @ZeroAlloc tags followed by an export function or arrow.
  const tagRegex =
    /@ZeroAlloc\b[\s\S]*?\*\/\s*\n((?:export\s+)?(?:async\s+)?function\s+(\w+)|const\s+(\w+)[^=]*=)/g
  for (const m of src.matchAll(tagRegex)) {
    const fn = m[2] ?? m[3] ?? "<anonymous>"
    const declStart = m.index! + m[0].length
    // Find the opening `{` after the declaration.
    let bodyStart = src.indexOf("{", declStart)
    if (bodyStart === -1) continue
    bodyStart++ // skip the `{`
    const bodyEnd = findFunctionEnd(src, bodyStart)
    const body = src.slice(bodyStart, bodyEnd)
    // Strip comments before scanning.
    const stripped = body
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
    for (const rule of FORBIDDEN) {
      const re = new RegExp(
        rule.pattern.source,
        rule.pattern.flags.includes("g")
          ? rule.pattern.flags
          : rule.pattern.flags + "g",
      )
      for (const hit of stripped.matchAll(re)) {
        const absPos = bodyStart + hit.index! // approx; comment-stripping shifts indices but line count is close
        violations.push({
          file: path,
          line: lineOf(src, absPos),
          fn,
          pattern: rule.name,
          snippet: hit[0],
        })
      }
    }
  }
  return violations
}

async function main(): Promise<void> {
  const root = join(import.meta.dir, "..")
  const glob = new Glob("src/**/*.ts")
  let total = 0
  const all: Violation[] = []
  for await (const rel of glob.scan({ cwd: root })) {
    if (rel.includes("__tests__")) continue
    const abs = join(root, rel)
    const v = lintFile(abs)
    if (v.length > 0) {
      all.push(...v)
      total += v.length
    }
  }
  if (total === 0) {
    console.log(
      "zero-alloc lint: clean (no violations in @ZeroAlloc-tagged functions)",
    )
    return
  }
  console.error(`zero-alloc lint: ${total} violation(s)\n`)
  for (const v of all) {
    const r = relative(root, v.file)
    console.error(
      `  ${r}:${v.line} ${v.fn}() - ${v.pattern}: ${v.snippet.trim()}`,
    )
  }
  process.exit(1)
}

void main()
