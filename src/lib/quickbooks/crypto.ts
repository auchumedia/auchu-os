import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Chiffrement des jetons QuickBooks au repos (AES-256-GCM) — ils ne sont
// JAMAIS écrits en clair dans quickbooks_connections.access_token_encrypted /
// refresh_token_encrypted. Format stocké : "<iv base64>.<tag base64>.<cipher base64>".
//
// QUICKBOOKS_TOKEN_ENCRYPTION_KEY doit être une clé de 32 octets encodée en
// base64 (ex: `openssl rand -base64 32`). Server-only — jamais exposée au
// client (pas de préfixe NEXT_PUBLIC_).

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const b64 = process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY
  if (!b64) throw new Error('QUICKBOOKS_TOKEN_ENCRYPTION_KEY manquant — impossible de chiffrer/déchiffrer les jetons QuickBooks')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error('QUICKBOOKS_TOKEN_ENCRYPTION_KEY doit décoder en exactement 32 octets')
  return key
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptToken(stored: string): string {
  const key = getKey()
  const [ivB64, tagB64, cipherB64] = stored.split('.')
  if (!ivB64 || !tagB64 || !cipherB64) throw new Error('Format de jeton chiffré invalide')

  const iv     = Buffer.from(ivB64, 'base64')
  const tag    = Buffer.from(tagB64, 'base64')
  const cipher = Buffer.from(cipherB64, 'base64')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()])
  return decrypted.toString('utf8')
}
