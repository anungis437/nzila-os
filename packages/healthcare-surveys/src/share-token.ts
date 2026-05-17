import { randomBytes } from 'crypto'

export function generateShareToken(size = 18): string {
  return randomBytes(size).toString('base64url')
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(token)
}
