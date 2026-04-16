import { expect, test, type Page } from '@playwright/test'

async function seedHeavyUserData(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase('KinetixDB')
      deleteRequest.onerror = () => reject(deleteRequest.error)
      deleteRequest.onsuccess = () => resolve()
      deleteRequest.onblocked = () => resolve()
    })

    const openRequest = indexedDB.open('KinetixDB', 80)
    openRequest.onupgradeneeded = () => {
      const db = openRequest.result
      const runs = db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true })
      runs.createIndex('date', 'date')
      runs.createIndex('distance', 'distance')
      runs.createIndex('source', 'source')
      runs.createIndex('external_id', 'external_id')
      runs.createIndex('deleted', 'deleted')

      const pb = db.createObjectStore('pb', { keyPath: 'id', autoIncrement: true })
      pb.createIndex('runId', 'runId')
      pb.createIndex('achievedAt', 'achievedAt')

      const weightHistory = db.createObjectStore('weightHistory', { keyPath: 'dateUnix' })
      weightHistory.createIndex('date', 'date')

      db.createObjectStore('providerConnections', { keyPath: 'id' })
      db.createObjectStore('providerSyncCheckpoints', { keyPath: 'id' })
      db.createObjectStore('providerSyncRuns', { keyPath: 'id' })
      db.createObjectStore('providerRawEvents', { keyPath: 'id' })
      db.createObjectStore('healthMetrics', { keyPath: 'id' })
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      openRequest.onerror = () => reject(openRequest.error)
      openRequest.onsuccess = () => resolve(openRequest.result)
    })

    const tx = db.transaction(['runs', 'pb', 'weightHistory'], 'readwrite')
    const runs = tx.objectStore('runs')
    const pb = tx.objectStore('pb')
    const weights = tx.objectStore('weightHistory')
    runs.clear()
    pb.clear()
    weights.clear()

    const now = Date.now()
    for (let i = 0; i < 80; i += 1) {
      const date = new Date(now - i * 86400_000).toISOString()
      runs.add({
        date,
        distance: 5000 + (i % 8) * 1000,
        duration: 1500 + i * 5,
        averagePace: 300,
        targetKPS: 80,
        locations: [],
        splits: [],
        notes: `Heavy fixture run ${i + 1}`,
        source: 'manual',
        deleted: 0,
        weightKg: 70,
      })
    }
    pb.add({
      runId: 1,
      achievedAt: new Date(now).toISOString(),
      profileSnapshot: { age: 35, weightKg: 70 },
    })
    for (let i = 0; i < 60; i += 1) {
      const dateUnix = Math.floor((now - i * 86400_000) / 1000)
      weights.add({
        dateUnix,
        date: new Date(dateUnix * 1000).toISOString(),
        kg: 70 + (i % 5) * 0.2,
      })
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
  })
}

test.describe('heavy user deterministic fixture', () => {
  test('history, charts, coaching, and mobile shell remain usable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedHeavyUserData(page)

    await page.goto('/history', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Heavy fixture run 1', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible()

    await page.goto('/menu', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /charts/i })).toBeVisible()

    await page.goto('/coaching', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Coaching' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/history', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible()
    await expect(page.getByText('Heavy fixture run 1', { exact: true })).toBeVisible()
  })
})
