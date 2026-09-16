import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 2400, deviceScaleFactor: 2 })
await page.goto('http://localhost:5199/#/dev/figures', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: process.argv[2], fullPage: true })
await browser.close()
