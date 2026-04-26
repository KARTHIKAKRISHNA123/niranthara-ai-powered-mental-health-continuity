// utils/encryption.js
// AES-256-GCM encryption for journal text and chat messages
// Key must be 64-char hex string (32 bytes) in ENCRYPTION_KEY env var

const crypto = require('crypto')

const getKey = () => {
  const hexKey = process.env.ENCRYPTION_KEY
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(hexKey, 'hex')
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} text — plaintext to encrypt
 * @returns {string} — "iv_hex:tag_hex:ciphertext_hex"
 */
const encrypt = (text) => {
  if (!text || typeof text !== 'string') return ''
  const KEY    = getKey()
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

/**
 * Decrypt AES-256-GCM ciphertext
 * @param {string} data — "iv_hex:tag_hex:ciphertext_hex"
 * @returns {string} — decrypted plaintext
 */
const decrypt = (data) => {
  if (!data || typeof data !== 'string') return ''
  try {
    const KEY         = getKey()
    const [ivH, tagH, encH] = data.split(':')
    const decipher    = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivH, 'hex'))
    decipher.setAuthTag(Buffer.from(tagH, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(encH, 'hex')),
      decipher.final()
    ]).toString('utf8')
  } catch (err) {
    console.error('Decryption failed:', err.message)
    return ''
  }
}

/**
 * Generate a new 64-char hex encryption key (run once, store securely)
 */
const generateKey = () => crypto.randomBytes(32).toString('hex')

module.exports = { encrypt, decrypt, generateKey }
