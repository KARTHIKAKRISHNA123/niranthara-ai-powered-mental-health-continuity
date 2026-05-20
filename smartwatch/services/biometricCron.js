// smartwatch/services/biometricCron.js
// node-cron scheduled sweep — every 15 minutes, matching passiveMonitor.js cadence

const cron = require('node-cron')
const { sweepAllUsers } = require('./BiometricSyncService')

let isRunning = false // Prevent overlapping sweeps

const startBiometricCron = () => {
  // Every 15 minutes: */15 * * * *
  cron.schedule('*/15 * * * *', async () => {
    if (isRunning) {
      console.log(`[BiometricSync] cron-skip: previous sweep still running at ${new Date().toISOString()}`)
      return
    }
    isRunning = true
    try {
      await sweepAllUsers()
    } catch (err) {
      console.error(`[BiometricSync] cron-error: ${err.message} at ${new Date().toISOString()}`)
    } finally {
      isRunning = false
    }
  })

  console.log(`[BiometricSync] cron-registered: */15 * * * * at ${new Date().toISOString()}`)
}

module.exports = { startBiometricCron }
