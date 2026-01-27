import { useSettingsStore } from '../store/settingsStore'
import { fetchStravaActivities, convertStravaToRunRecord } from '../lib/strava'
import { db } from '../lib/database'
import { useState } from 'react'
import { computeKpsWithPb } from '@kinetix/core'

export default function Settings() {
  const {
    userProfile,
    setUserProfile,
    targetKps,
    setTargetKps,
    unitSystem,
    setUnitSystem,
    physioMode,
    setPhysioMode,
    stravaToken,
    setStravaToken,
  } = useSettingsStore()
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  return (
    <div className="pb-20">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Age</label>
            <input
              type="number"
              value={userProfile.age}
              onChange={(e) => setUserProfile({ ...userProfile, age: parseInt(e.target.value) || 30 })}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Weight (kg)</label>
            <input
              type="number"
              value={userProfile.weightKg}
              onChange={(e) => setUserProfile({ ...userProfile, weightKg: parseFloat(e.target.value) || 70 })}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Target KPS (0–100)</label>
            <input
              type="number"
              value={targetKps}
              min={0}
              max={100}
              step={0.1}
              onChange={(e) => setTargetKps(parseFloat(e.target.value) || 95)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Unit System</label>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as 'metric' | 'imperial')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2"
            >
              <option value="metric">Metric (km)</option>
              <option value="imperial">Imperial (miles)</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Physio-Pacer Mode</label>
            <button
              onClick={() => setPhysioMode(!physioMode)}
              className={`w-12 h-6 rounded-full transition-all ${
                physioMode ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-all ${
                physioMode ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400 uppercase">Strava Sync</div>
                <p className="text-[11px] text-gray-500">
                  Paste a Strava personal access token with <code className="text-cyan-400">activity:read_all</code> scope. 
                  Generate at: <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">strava.com/settings/api</a>
                </p>
              </div>
              <button
                onClick={async () => {
                  setImportMessage(null)
                  try {
                    setImporting(true)
                    const activities = await fetchStravaActivities(stravaToken)
                    if (activities.length === 0) {
                      setImportMessage('No recent activities found.')
                      return
                    }
                    const records = activities
                      .map((activity) => convertStravaToRunRecord(activity, targetKps))
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                    await db.transaction('rw', db.runs, db.meta, async () => {
                      const meta = await db.meta.get('kps')
                      let pbEq5kSec: number | null = meta?.pb_eq5k_sec ?? null

                      for (const rec of records) {
                        const result = computeKpsWithPb({
                          distanceKm: rec.distance / 1000,
                          timeSeconds: rec.duration,
                          pbEq5kSec,
                        })
                        pbEq5kSec = result.pbEq5kSecNext

                        await db.runs.add({
                          ...rec,
                          kps: Math.round(result.kps * 10) / 10,
                          set_pb: result.setPb,
                          targetKps,
                        })
                      }

                      if (pbEq5kSec && Number.isFinite(pbEq5kSec) && pbEq5kSec > 0) {
                        await db.meta.put({ id: 'kps', pb_eq5k_sec: pbEq5kSec })
                      }
                    })

                    setImportMessage(`Imported ${records.length} activities.`)
                  } catch (error) {
                    console.error('Strava import error', error)
                    const errorMsg = error instanceof Error ? error.message : 'Failed to import from Strava. Check token.'
                    setImportMessage(`Error: ${errorMsg}`)
                  } finally {
                    setImporting(false)
                  }
                }}
                className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-4 py-2 rounded-full transition"
                disabled={importing || !stravaToken.trim()}
              >
                {importing ? 'Importing…' : 'Import from Strava'}
              </button>
            </div>
            <input
              type="password"
              value={stravaToken}
              onChange={(e) => setStravaToken(e.target.value)}
              placeholder="Paste Strava token"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-sm"
            />
            {importMessage && (
              <div className={`text-xs ${importMessage.startsWith('Error:') ? 'text-red-400' : 'text-gray-300'}`}>
                {importMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
