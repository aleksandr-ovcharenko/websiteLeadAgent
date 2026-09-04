#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = 'apps/platform/src'
const EXCLUDES = ['theme/']

function shouldProcess(p) {
  if (!p.endsWith('.tsx') && !p.endsWith('.css')) return false
  for (const ex of EXCLUDES) if (p.includes(ex)) return false
  return true
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (shouldProcess(p)) yield p
  }
}

// ── bracket color literal → token class ──────────────────────────────────────
const bracketMap = new Map([
  // backgrounds
  ['bg-[#F4F4F3]', 'bg-bg'],
  ['bg-[#f4f5f7]', 'bg-bg'],
  ['bg-[#ffffff]', 'bg-surface'],
  ['bg-[#fff]', 'bg-surface'],
  ['bg-[#fafaf9]', 'bg-surface-raised'],
  ['bg-[#fafaf8]', 'bg-surface-raised'],
  ['bg-[#fafafa]', 'bg-surface-raised'],
  ['bg-[#f5f4f2]', 'bg-surface-raised'],
  ['bg-[#f0ede8]', 'bg-surface-hover'],
  ['bg-[#f0eeeb]', 'bg-surface-hover'],
  ['bg-[#efede9]', 'bg-surface-hover'],
  ['bg-[#ebe9e5]', 'bg-surface-hover'],
  ['bg-[#e7e5e4]', 'bg-surface-hover'],
  ['bg-[#e5e3df]', 'bg-surface-hover'],
  ['bg-[#ddd9d4]', 'bg-surface-hover'],
  ['bg-[#d1cdc7]', 'bg-surface-hover'],
  ['bg-[#d1d5db]', 'bg-surface-hover'],
  ['bg-[#c0bdb8]', 'bg-surface-hover'],
  ['bg-[#1c1917]', 'bg-surface-inverse'],
  ['bg-[#1C1917]', 'bg-surface-inverse'],
  ['bg-[#171f2e]', 'bg-surface-inverse'],
  ['bg-[#1a2332]', 'bg-surface-inverse'],
  ['bg-[#292524]', 'bg-surface-inverse'],
  ['bg-[#44403c]', 'bg-surface-inverse'],
  ['bg-[#1c1917]/60', 'bg-overlay/60'],
  ['bg-[#16a34a]', 'bg-accent'],
  ['bg-[#16A34A]', 'bg-accent'],
  ['bg-[#16a34a]/10', 'bg-accent/10'],
  ['bg-[#15803d]', 'bg-accent-hover'],
  ['bg-[#15803D]', 'bg-accent-hover'],
  ['bg-[#276749]', 'bg-accent'],
  ['bg-[#1f5238]', 'bg-accent-hover'],
  ['bg-[#f0f9f4]', 'bg-success-subtle'],
  ['bg-[#f0fdf4]', 'bg-success-subtle'],
  ['bg-[#f5fbf7]', 'bg-success-subtle'],
  ['bg-[#e6f5ed]', 'bg-success-subtle'],
  ['bg-[#c3dece]', 'bg-success-subtle'],
  ['bg-[#8ecdb0]', 'bg-success-subtle'],
  ['bg-[#7cc4a4]', 'bg-success-subtle'],
  ['bg-[#fffdf5]', 'bg-warning-subtle'],
  ['bg-[#fdf8ee]', 'bg-warning-subtle'],
  ['bg-[#fde8e8]', 'bg-danger-subtle'],
  ['bg-[#fdf2f2]', 'bg-danger-subtle'],
  ['bg-[#f0b8b8]', 'bg-danger-subtle'],
  ['bg-[#e0a0a0]', 'bg-danger-subtle'],
  ['bg-[#e8d5a3]', 'bg-warning-subtle'],
  ['bg-[#92600a]/90', 'bg-warning/90'],
  ['bg-[#9b1c1c]', 'bg-danger'],
  ['bg-[#d97706]', 'bg-warning'],

  // text
  ['text-[#1c1917]', 'text-text'],
  ['text-[#1C1917]', 'text-text'],
  ['text-[#44403c]', 'text-text'],
  ['text-[#292524]', 'text-text'],
  ['text-[#57534e]', 'text-text'],
  ['text-[#a8a29e]', 'text-text-subtle'],
  ['text-[#c0bdb8]', 'text-text-subtle'],
  ['text-[#ddd9d4]', 'text-text-subtle'],
  ['text-[#78716c]', 'text-text-muted'],
  ['text-[#78716C]', 'text-text-muted'],
  ['text-[#16a34a]', 'text-accent'],
  ['text-[#276749]', 'text-accent'],
  ['text-[#15803d]', 'text-accent'],
  ['text-[#52b788]', 'text-success'],
  ['text-[#4ade80]', 'text-success'],
  ['text-[#8ecdb0]', 'text-success'],
  ['text-[#9b1c1c]', 'text-danger'],
  ['text-[#c0807e]', 'text-danger-subtle'],
  ['text-[#f0b8b8]', 'text-danger-subtle'],
  ['text-[#92600a]', 'text-warning'],
  ['text-[#e8d5a3]', 'text-warning-subtle'],
  ['text-[#D97706]', 'text-warning'],
  ['text-[#FCD34D]', 'text-warning'],
  ['text-[#e7e5e4]', 'text-text-inverse'],

  // borders
  ['border-[#e5e3df]', 'border-border'],
  ['border-[#E4E4E2]', 'border-border'],
  ['border-[#f0ede8]', 'border-border'],
  ['border-[#ddd9d4]', 'border-border'],
  ['border-[#d1cdc7]', 'border-border'],
  ['border-[#a8a29e]', 'border-border'],
  ['border-[#16a34a]', 'border-accent'],
  ['border-[#276749]', 'border-accent'],
  ['border-[#15803d]', 'border-accent'],
  ['border-[#1c1917]', 'border-surface-inverse'],
  ['border-[#c3dece]', 'border-success-subtle'],
  ['border-[#e8d5a3]', 'border-warning-subtle'],

  // rings
  ['ring-[#16a34a]', 'ring-accent'],
  ['ring-[#16A34A]', 'ring-accent'],
  ['ring-[#16a34a]/20', 'ring-accent/20'],
])

function applyBrackets(content) {
  for (const [from, to] of bracketMap) {
    content = content.split(from).join(to)
  }
  return content
}

// ── generic utility color classes → semantic token classes ───────────────────
const colorFamilies = new Set(['gray', 'stone', 'red', 'emerald', 'green', 'amber', 'blue', 'sky', 'teal', 'purple', 'black', 'white'])

function replaceUtility(match, prefix = '', kind, family, shade = '', opacity = '') {
  if (!colorFamilies.has(family)) return match
  let token
  const s = shade || ''
  const op = opacity || ''

  // whites / blacks
  if (family === 'white') {
    if (kind === 'bg') token = 'surface'
    if (kind === 'text') token = 'text-inverse'
    if (kind === 'border') token = 'text-inverse'
  } else if (family === 'black') {
    if (kind === 'bg') token = 'overlay'
    if (kind === 'text') token = 'text'
    if (kind === 'border') token = 'border'
  } else if (family === 'gray' || family === 'stone') {
    if (kind === 'bg') {
      if (s === '50') token = 'surface-raised'
      else if (s === '100' || s === '200' || s === '300' || s === '400') token = 'surface-hover'
      else if (s === '800' || s === '900') token = 'surface-inverse'
      else token = 'surface-raised'
    } else if (kind === 'text') {
      if (s === '200' || s === '300' || s === '400') token = 'text-subtle'
      else if (s === '500' || s === '600') token = 'text-muted'
      else token = 'text'
    } else if (kind === 'border' || kind === 'ring') {
      token = 'border'
    }
  } else if (family === 'red') {
    if (kind === 'bg') token = s === '700' ? 'danger-hover' : (['50', '100', '200', '50/30', '50/40'].includes(s + op) ? 'danger-subtle' : 'danger')
    else if (kind === 'text') token = 'danger'
    else if (kind === 'border' || kind === 'ring') token = ['100', '200', '300'].includes(s) ? 'danger-subtle' : 'danger'
  } else if (family === 'emerald' || family === 'green') {
    if (kind === 'bg') token = s === '700' ? 'success-hover' : (['50', '100'].includes(s) ? 'success-subtle' : 'success')
    else if (kind === 'text') token = 'success'
    else if (kind === 'border' || kind === 'ring') token = s === '200' ? 'success-subtle' : 'success'
  } else if (family === 'amber') {
    if (kind === 'bg') token = ['50', '100', '50/90'].includes(s + op) ? 'warning-subtle' : (s === '900' ? 'warning' : 'warning')
    else if (kind === 'text') token = 'warning'
    else if (kind === 'border' || kind === 'ring') token = ['100', '200'].includes(s) ? 'warning-subtle' : 'warning'
  } else if (family === 'blue' || family === 'sky' || family === 'teal' || family === 'purple') {
    if (kind === 'bg') token = 'info-subtle'
    else if (kind === 'text') token = 'info'
    else if (kind === 'border' || kind === 'ring') token = ['100', '200'].includes(s) ? 'info-subtle' : 'info'
  }

  if (!token) return match
  // ring -> kind stays ring; border -> border
  const kindOut = kind === 'ring' ? 'ring' : kind
  if (kind === 'ring' && token.startsWith('border')) token = token.replace('border-', 'ring-')
  return `${prefix}${kindOut}-${token}${op}`
}

const utilityRegex = /\b(hover:|focus:|focus-visible:|disabled:|active:|group-hover:|group-focus:|)?(bg|text|border|ring)-(white|black|gray|stone|red|emerald|green|amber|blue|sky|teal|purple)(?:-(\d{2,3}))?(\/\d{1,3})?\b/g

function applyUtilities(content) {
  return content.replace(utilityRegex, replaceUtility)
}

async function main() {
  for await (const file of walk(ROOT)) {
    const original = await fs.readFile(file, 'utf8')
    let updated = applyBrackets(original)
    updated = applyUtilities(updated)
    if (updated !== original) {
      await fs.writeFile(file, updated, 'utf8')
      console.log('updated', file)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
