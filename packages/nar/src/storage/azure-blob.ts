import { BlobServiceClient, BlockBlobClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import type { NarRecord, NarStorageRef } from '../types'

const DEFAULT_RETENTION_YEARS = 7

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

function getBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (connectionString && connectionString.trim().length > 0) {
    return BlobServiceClient.fromConnectionString(connectionString)
  }

  const accountName = requiredEnv('AZURE_STORAGE_ACCOUNT_NAME')
  const accountKey = requiredEnv('AZURE_STORAGE_ACCOUNT_KEY')
  return new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new StorageSharedKeyCredential(accountName, accountKey),
  )
}

function toRetentionUntil(createdAtIso: string, retentionYears: number): string {
  const createdAt = new Date(createdAtIso)
  const retention = new Date(createdAt)
  retention.setUTCFullYear(retention.getUTCFullYear() + retentionYears)
  return retention.toISOString()
}

function getBlobPath(record: NarRecord): string {
  const yyyy = record.createdAt.slice(0, 4)
  const mm = record.createdAt.slice(5, 7)
  const dd = record.createdAt.slice(8, 10)
  return `${record.organizationId}/${yyyy}/${mm}/${dd}/${record.id}.nar.json`
}

function getContainerName(): string {
  return process.env.NAR_AUDIT_CONTAINER_NAME ?? process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'audit-records'
}

function getAccountNameForUri(): string {
  const fromConn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (fromConn && fromConn.includes('AccountName=')) {
    const part = fromConn.split(';').find((item) => item.startsWith('AccountName='))
    if (part) return part.replace('AccountName=', '')
  }
  return requiredEnv('AZURE_STORAGE_ACCOUNT_NAME')
}

async function enforceImmutability(
  blob: BlockBlobClient,
  retentionUntil: Date,
): Promise<void> {
  const expiresOn = new Date(retentionUntil)

  await blob.setImmutabilityPolicy({
    expiriesOn: expiresOn,
    policyMode: 'Unlocked',
  })

  const lock = (process.env.NAR_IMMUTABILITY_LOCK_MODE ?? 'locked').toLowerCase()
  if (lock === 'locked') {
    await blob.setImmutabilityPolicy({
      expiriesOn: expiresOn,
      policyMode: 'Locked',
    })
  }

  if ((process.env.NAR_LEGAL_HOLD ?? 'true').toLowerCase() === 'true') {
    await blob.setLegalHold(true)
  }
}

export async function uploadNarToAzureImmutableBlob(record: NarRecord, retentionYears = DEFAULT_RETENTION_YEARS): Promise<NarStorageRef> {
  const service = getBlobServiceClient()
  const container = service.getContainerClient(getContainerName())
  await container.createIfNotExists()

  const blobPath = getBlobPath(record)
  const blob = container.getBlockBlobClient(blobPath)

  const payload = Buffer.from(JSON.stringify(record), 'utf8')
  await blob.uploadData(payload, {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    conditions: { ifNoneMatch: '*' },
  })

  const retentionUntil = toRetentionUntil(record.createdAt, retentionYears)
  await enforceImmutability(blob, new Date(retentionUntil))

  const account = getAccountNameForUri()
  const uri = `https://${account}.blob.core.windows.net/${container.containerName}/${blobPath}`

  return {
    type: 'azure_blob',
    uri,
    immutable: true,
    retentionUntil,
  }
}
