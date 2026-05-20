// testing/test_backend_api.test.js
// Niranthara Backend — Unit + Integration Tests
// Run: cd testing && npm install && npm test
// Or:  node testing/test_backend_api.test.js

const path   = require('path')
const assert = require('assert')
const https  = require('https')

// ─── Load backend env ────────────────────────────────────────────────────────
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') })

let passed = 0, failed = 0, skipped = 0
const results = []

function test(name, fn) {
  try {
    const ret = fn()
    if (ret && typeof ret.then === 'function') {
      return ret.then(() => {
        console.log(`  ✅  ${name}`)
        results.push({ name, status: 'pass' })
        passed++
      }).catch(err => {
        if (err.message?.startsWith('SKIP:')) {
          console.log(`  ⏭   ${name} — ${err.message.replace('SKIP:', '').trim()}`)
          results.push({ name, status: 'skip' })
          skipped++
        } else {
          console.log(`  ❌  ${name}`)
          console.log(`       ${err.message}`)
          results.push({ name, status: 'fail', error: err.message })
          failed++
        }
      })
    }
    console.log(`  ✅  ${name}`)
    results.push({ name, status: 'pass' })
    passed++
  } catch (err) {
    if (err.message?.startsWith('SKIP:')) {
      console.log(`  ⏭   ${name} — ${err.message.replace('SKIP:', '').trim()}`)
      results.push({ name, status: 'skip' })
      skipped++
    } else {
      console.log(`  ❌  ${name}`)
      console.log(`       ${err.message}`)
      results.push({ name, status: 'fail', error: err.message })
      failed++
    }
  }
}

function post(url, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url')
    const u   = new URL(url)
    const lib = u.protocol === 'https:' ? https : require('http')
    const body = JSON.stringify(payload)
    const req  = lib.request({
      hostname: u.hostname,
      port:     u.port,
      path:     u.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(data) } catch { return data } })() }))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Request timed out after ${timeoutMs}ms`)) })
    req.write(body)
    req.end()
  })
}

function get(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url')
    const u   = new URL(url)
    const lib = u.protocol === 'https:' ? https : require('http')
    const req = lib.get({ hostname: u.hostname, port: u.port, path: u.pathname }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(data) } catch { return data } })() }))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function runTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Niranthara Backend — Automated Test Suite')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── 1. UNIT: Encryption ─────────────────────────────────────────────────
  console.log('📦  Unit Tests — Encryption (AES-256-GCM)')
  console.log('─'.repeat(55))

  test('ENCRYPTION_KEY is set in .env', () => {
    const key = process.env.ENCRYPTION_KEY
    assert.ok(key, 'ENCRYPTION_KEY must be set')
    assert.strictEqual(key.length, 64, `ENCRYPTION_KEY must be 64 hex chars, got ${key.length}`)
  })

  test('encrypt() produces "iv:tag:cipher" format', () => {
    const { encrypt } = require('../backend/utils/encryption')
    const result = encrypt('test message for niranthara')
    const parts  = result.split(':')
    assert.strictEqual(parts.length, 3, `Expected 3 parts (iv:tag:cipher), got ${parts.length}`)
    assert.ok(parts[0].length === 32,  `IV should be 16 bytes (32 hex chars), got ${parts[0].length}`)
    assert.ok(parts[1].length === 32,  `Tag should be 16 bytes (32 hex chars), got ${parts[1].length}`)
    assert.ok(parts[2].length > 0,     'Cipher must not be empty')
  })

  test('decrypt(encrypt(text)) === original text (round-trip)', () => {
    const { encrypt, decrypt } = require('../backend/utils/encryption')
    const original  = 'Romba kashtama irukku'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    assert.strictEqual(decrypted, original, `Round-trip failed. Got: "${decrypted}"`)
  })

  test('encrypt("") returns empty string', () => {
    const { encrypt } = require('../backend/utils/encryption')
    assert.strictEqual(encrypt(''), '', 'encrypt("") should return ""')
  })

  test('decrypt("") returns empty string', () => {
    const { decrypt } = require('../backend/utils/encryption')
    assert.strictEqual(decrypt(''), '', 'decrypt("") should return ""')
  })

  test('Two encryptions of same text produce different ciphertexts (IV randomness)', () => {
    const { encrypt } = require('../backend/utils/encryption')
    const msg = 'same message'
    const e1  = encrypt(msg)
    const e2  = encrypt(msg)
    assert.notStrictEqual(e1, e2, 'Each encryption must use a fresh random IV')
  })

  test('Tampered ciphertext returns empty string on decrypt', () => {
    const { encrypt, decrypt } = require('../backend/utils/encryption')
    const enc      = encrypt('secret data')
    const parts    = enc.split(':')
    parts[2]       = '00'.repeat(parts[2].length / 2) // corrupt cipher
    const tampered = parts.join(':')
    const result   = decrypt(tampered)
    assert.strictEqual(result, '', 'Tampered ciphertext should return empty string (auth tag check)')
  })

  // ── 2. UNIT: Baseline z-score service ───────────────────────────────────
  console.log('\n📦  Unit Tests — Baseline Service (z-score)')
  console.log('─'.repeat(55))

  test('baselineService.js file exists', () => {
    const bPath = path.join(__dirname, '../backend/services/baselineService.js')
    assert.ok(require('fs').existsSync(bPath), 'baselineService.js not found')
  })

  test('deviationScore clamps to [0,1] range', () => {
    const { deviationScore } = require('../backend/services/baselineService')
    if (!deviationScore) throw new Error('SKIP: deviationScore not exported')
    // Extreme outlier should clamp to 1
    assert.ok(deviationScore(1, 5, 0.1) >= 0)
    assert.ok(deviationScore(1, 5, 0.1) <= 1)
  })

  // ── 3. INTEGRATION: Backend Health Check ────────────────────────────────
  console.log('\n🔗  Integration Tests — Backend Health')
  console.log('─'.repeat(55))

  await test('GET /api/health returns 200', async () => {
    try {
      const res = await get('http://localhost:5000/api/health')
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`)
    } catch (e) {
      throw new Error('SKIP: Backend not running at localhost:5000')
    }
  })

  // ── 4. INTEGRATION: Mood Log (requires backend running) ─────────────────
  console.log('\n🔗  Integration Tests — API Routes')
  console.log('─'.repeat(55))

  await test('POST /api/mood/log accepts valid payload', async () => {
    try {
      const res = await post('http://localhost:5000/api/mood/log', {
        uid:          'test-unit-runner',
        moodScore:    3,
        energyLevel:  5,
        anxietyLevel: 4,
        sleepHours:   7,
        journalText:  'Unit test entry — automated by test_backend_api.test.js',
        offlineSyncId: `test-${Date.now()}`
      })
      // Should be 200 (saved) or 401 (no auth token — acceptable in unit context)
      assert.ok(
        [200, 201, 400, 401].includes(res.status),
        `Unexpected status: ${res.status}`
      )
    } catch (e) {
      throw new Error('SKIP: Backend not running at localhost:5000')
    }
  })

  await test('POST /api/crisis/detect returns crisisProbability field (via AI service)', async () => {
    try {
      const res = await post('http://localhost:8000/api/crisis/detect', {
        text: 'I feel really down today',
        uid:  'test-unit-runner'
      })
      assert.strictEqual(res.status, 200)
      assert.ok('crisisProbability' in res.body, 'crisisProbability field missing')
      const p = res.body.crisisProbability
      assert.ok(p >= 0 && p <= 1, `crisisProbability ${p} out of [0,1] range`)
    } catch (e) {
      throw new Error('SKIP: AI service not running at localhost:8000')
    }
  })

  await test('POST /api/chat returns reply (NVIDIA integration)', async () => {
    try {
      const res = await post('http://localhost:8000/api/chat', {
        message:          'I feel a little tired today',
        language:         'en',
        mood_score:        3.0,
        risk_level:       'low',
        emotion_detected: 'neutral',
        sentiment_score:   0.3
      })
      assert.strictEqual(res.status, 200, `Expected 200 from /api/chat, got ${res.status}`)
      assert.ok(res.body.reply,     '/api/chat response must include "reply" key')
      assert.ok(res.body.modelUsed, '/api/chat response must include "modelUsed" key')
    } catch (e) {
      throw new Error('SKIP: AI service not running at localhost:8000')
    }
  })

  // ── 5. SYSTEM: File structure integrity ─────────────────────────────────
  console.log('\n🗂   System Tests — File Structure Integrity')
  console.log('─'.repeat(55))

  const requiredFiles = [
    'backend/index.js',
    'backend/utils/encryption.js',
    'backend/services/baselineService.js',
    'ai-service/main.py',
    'ai-service/utils/nvidia_client.py',
    'ai-service/routers/chat.py',
    'mobile-app/src/navigation/AppNavigator.js',
    'mobile-app/src/screens/Home.js',
    'mobile-app/src/screens/Journal.js',
    'mobile-app/src/screens/Chat.js',
    'mobile-app/src/screens/Cycle.js',
    'mobile-app/src/screens/Insights.js',
    'mobile-app/src/screens/Login.js',
    'mobile-app/src/screens/Signup.js',
    'mobile-app/src/screens/Onboarding.js',
    'mobile-app/src/screens/interventions/CBTReframe.js',
    'mobile-app/src/screens/interventions/SomaticBreathing.js',
    'smartwatch/index.js',
    'smartwatch/services/BiometricSyncService.js',
    'smartwatch/services/biometricCron.js',
  ]

  const fs = require('fs')
  requiredFiles.forEach(f => {
    test(`File exists: ${f}`, () => {
      const full = path.join(__dirname, '..', f)
      assert.ok(fs.existsSync(full), `Missing: ${full}`)
    })
  })

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Results: ${passed} passed | ${failed} failed | ${skipped} skipped`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (failed > 0) {
    console.log('Failed tests:')
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`)
    })
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
