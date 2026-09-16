import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 2500))
const info = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker?.getRegistration()
  const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute('href')
  const res = manifestLink ? await fetch(manifestLink) : null
  const manifest = res ? await res.json() : null
  return { sw: !!reg, swState: reg?.active?.state ?? null, manifestName: manifest?.name, icons: manifest?.icons?.length, title: document.querySelector('.hp__title')?.textContent }
})
console.log(JSON.stringify(info))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
