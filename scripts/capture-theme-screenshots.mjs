#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = 'http://localhost:3004'
const OUT = path.resolve(process.cwd(), 'apps/platform/screenshots')
const SITE_ID = 'cmtm4j51k00ihbmvqjwukcpwh'

const views = [
  { name: 'hub', url: '/' },
  { name: 'radar', url: '/radar' },
  { name: 'factory', url: '/factory' },
  { name: 'forge', url: '/forge' },
  { name: 'studio', url: `/studio/${SITE_ID}` },
]

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }) } catch {}
}

async function waitForHeader(page) {
  await page.waitForSelector('text=WebsiteLeadAgent', { timeout: 15000 })
  await page.waitForTimeout(400)
}

async function login(page) {
  await page.goto(BASE, { waitUntil: 'load' })
  // If already authenticated, the main app will render; otherwise a login form.
  const login = page.locator('text=Platform Admin')
  if (await login.isVisible().catch(() => false)) {
    await page.locator('input[type="email"]').fill('admin@minsk.local')
    await page.locator('input[type="password"]').fill('admin123')
    await page.locator('button:has-text("Sign in")').click()
    await waitForHeader(page)
  } else {
    await waitForHeader(page)
  }
}

async function setTheme(page, theme, colorScheme = 'light') {
  await page.emulateMedia({ colorScheme })
  await page.evaluate((t) => {
    localStorage.setItem('wla-theme', t)
  }, theme)
  await page.reload({ waitUntil: 'load' })
  await waitForHeader(page)
}

async function captureView(page, theme, view) {
  await page.goto(`${BASE}${view.url}`, { waitUntil: 'load' })
  await waitForHeader(page)
  const file = path.join(OUT, `${theme}-${view.name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`saved ${file}`)
}

async function captureDropdown(page, theme) {
  await page.goto(BASE, { waitUntil: 'load' })
  await waitForHeader(page)
  const toggle = page.locator('[aria-label="Appearance"]')
  await toggle.click()
  await page.waitForTimeout(200)
  const file = path.join(OUT, `${theme}-theme-dropdown.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`saved ${file}`)
}

async function captureConsole(page, theme) {
  await page.goto(`${BASE}/factory`, { waitUntil: 'load' })
  await waitForHeader(page)
  const activityConsole = page.locator('[data-testid="activity-console"]')
  if (await activityConsole.isVisible().catch(() => false)) {
    await activityConsole.click()
    await page.waitForTimeout(300)
  }
  const file = path.join(OUT, `${theme}-activity-console.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`saved ${file}`)
}

async function main() {
  await ensureDir(OUT)
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await login(page)

  const themes = [
    { name: 'light', theme: 'light', colorScheme: 'light' },
    { name: 'dark', theme: 'dark', colorScheme: 'dark' },
    { name: 'system-dark', theme: 'system', colorScheme: 'dark' },
  ]

  for (const { name, theme, colorScheme } of themes) {
    await setTheme(page, theme, colorScheme)
    for (const view of views) {
      await captureView(page, name, view)
    }
    await captureDropdown(page, name)
    await captureConsole(page, name)
  }

  await browser.close()
  console.log(`Screenshots written to ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
