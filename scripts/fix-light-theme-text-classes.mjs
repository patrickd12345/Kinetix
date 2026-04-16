#!/usr/bin/env node
/**
 * Replace dark-assumed Tailwind grays with slate + dark: pairs for light theme readability.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = join(process.cwd(), 'apps', 'web', 'src')

/** Longer / prefixed patterns first */
const RULES = [
  [/hover:text-gray-200\b/g, 'hover:text-slate-800 dark:hover:text-gray-200'],
  [/hover:text-gray-300\b/g, 'hover:text-slate-700 dark:hover:text-gray-300'],
  [/hover:text-gray-400\b/g, 'hover:text-slate-600 dark:hover:text-gray-400'],
  [/hover:text-gray-500\b/g, 'hover:text-slate-500 dark:hover:text-gray-500'],
  [/(?<!dark:)text-gray-200\b/g, 'text-slate-800 dark:text-gray-200'],
  [/(?<!dark:)text-gray-300\b/g, 'text-slate-700 dark:text-gray-300'],
  [/(?<!dark:)text-gray-400\b/g, 'text-slate-600 dark:text-gray-400'],
  [/(?<!dark:)text-gray-500\b/g, 'text-slate-500 dark:text-gray-500'],
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (extname(p) === '.tsx' || extname(p) === '.ts') out.push(p)
  }
  return out
}

let filesChanged = 0
for (const file of walk(ROOT)) {
  let s = readFileSync(file, 'utf8')
  const before = s
  for (const [re, rep] of RULES) {
    s = s.replace(re, rep)
  }
  if (s !== before) {
    writeFileSync(file, s, 'utf8')
    filesChanged += 1
  }
}

console.log(`Updated ${filesChanged} file(s) under apps/web/src`)
