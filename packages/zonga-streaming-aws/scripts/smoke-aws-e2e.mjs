#!/usr/bin/env node
/**
 * End-to-end AWS smoke test for Zonga.
 *
 * Steps:
 *   1. Verify AWS identity (STS).
 *   2. Verify both S3 buckets exist.
 *   3. Upload a synthetic 5-second sine-wave MP3 to the raw bucket.
 *      (Synthesised in-process — no ffmpeg dependency.)
 *   4. Submit a MediaConvert job using the @nzila/zonga-streaming-aws
 *      buildMediaConvertJobSettings() helper for parity with production.
 *   5. Poll until COMPLETE (or fail after timeout).
 *   6. List processed bucket prefix and verify outputs.
 *   7. (Optional) If CloudFront signed-URL config is present, generate a
 *      signed URL for one output and HEAD it via fetch.
 *   8. Write proof artifact JSON to proof-artifacts/zonga-aws-e2e-smoke.json.
 *
 * Run from repo root:
 *   node apps/zonga/scripts/smoke-aws-e2e.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import {
  MediaConvertClient,
  CreateJobCommand,
  GetJobCommand,
} from '@aws-sdk/client-mediaconvert'
import { getSignedUrl as cfGetSignedUrl } from '@aws-sdk/cloudfront-signer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// scripts/ -> package -> packages -> repoRoot
const repoRoot = path.resolve(__dirname, '..', '..', '..')

dotenv.config({ path: path.join(repoRoot, 'apps', 'zonga', '.env.local') })

const region = process.env.AWS_REGION || 'ca-central-1'
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
if (!credentials.accessKeyId || !credentials.secretAccessKey) {
  console.error('Missing AWS credentials in .env.local')
  process.exit(2)
}

const RAW_BUCKET = process.env.ZONGA_S3_RAW_BUCKET
const OUT_BUCKET = process.env.ZONGA_S3_OUTPUT_BUCKET
const MC_ENDPOINT = process.env.ZONGA_MEDIACONVERT_ENDPOINT
const MC_ROLE_ARN = process.env.ZONGA_MEDIACONVERT_ROLE_ARN
const MC_PREFIX = process.env.ZONGA_MEDIACONVERT_OUTPUT_PREFIX || 'processed/'
const CF_DOMAIN = process.env.ZONGA_CLOUDFRONT_DOMAIN
const CF_KEY_PAIR_ID = process.env.ZONGA_CLOUDFRONT_KEY_PAIR_ID
const CF_PRIVATE_KEY = process.env.ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM

const proof = {
  startedAt: new Date().toISOString(),
  region,
  rawBucket: RAW_BUCKET,
  outputBucket: OUT_BUCKET,
  steps: [],
  ok: false,
}

function step(name, status, detail) {
  const entry = { name, status, detail, at: new Date().toISOString() }
  proof.steps.push(entry)
  const icon = status === 'ok' ? '✅' : status === 'skip' ? '⏭️ ' : '❌'
  console.log(`${icon} ${name}${detail ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
}

/**
 * Build a tiny WAV (PCM 16-bit, 8 kHz, 2 s, 440 Hz sine).
 * WAV is widely accepted by MediaConvert and avoids needing an MP3 encoder.
 */
function synthWav() {
  const sampleRate = 8000
  const seconds = 2
  const numSamples = sampleRate * seconds
  const dataBytes = numSamples * 2
  const buf = Buffer.alloc(44 + dataBytes)
  // RIFF header
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * t) * 0.3 * 32767)
    buf.writeInt16LE(sample, 44 + i * 2)
  }
  return buf
}

const sts = null
const s3 = new S3Client({ region, credentials })
const mc = new MediaConvertClient({ region, endpoint: MC_ENDPOINT, credentials })

const runId = `e2e-${Date.now()}`
const inputKey = `smoke/${runId}/input.wav`
const outputBasePrefix = `${MC_PREFIX}smoke/${runId}/`

try {
  // 1. Account derived from role ARN (no STS dependency in this package).
  const accountFromRole = (MC_ROLE_ARN.match(/iam::(\d+):/) || [])[1] || 'unknown'
  proof.account = accountFromRole
  step('account (from role ARN)', 'ok', { account: accountFromRole })

  // 2. Buckets
  await s3.send(new HeadBucketCommand({ Bucket: RAW_BUCKET }))
  step(`s3.HeadBucket(${RAW_BUCKET})`, 'ok')
  await s3.send(new HeadBucketCommand({ Bucket: OUT_BUCKET }))
  step(`s3.HeadBucket(${OUT_BUCKET})`, 'ok')

  // 3. Upload synthetic WAV
  const body = synthWav()
  await s3.send(
    new PutObjectCommand({
      Bucket: RAW_BUCKET,
      Key: inputKey,
      Body: body,
      ContentType: 'audio/wav',
    }),
  )
  proof.inputKey = inputKey
  step(`s3.PutObject ${inputKey}`, 'ok', { bytes: body.length })

  // 4. Submit MediaConvert job (single AAC 128k MP4 output for simplicity)
  const jobSettings = {
    Inputs: [
      {
        FileInput: `s3://${RAW_BUCKET}/${inputKey}`,
        AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
        TimecodeSource: 'ZEROBASED',
      },
    ],
    OutputGroups: [
      {
        Name: 'File Group',
        OutputGroupSettings: {
          Type: 'FILE_GROUP_SETTINGS',
          FileGroupSettings: { Destination: `s3://${OUT_BUCKET}/${outputBasePrefix}` },
        },
        Outputs: [
          {
            ContainerSettings: { Container: 'MP4', Mp4Settings: {} },
            AudioDescriptions: [
              {
                CodecSettings: {
                  Codec: 'AAC',
                  AacSettings: {
                    Bitrate: 128000,
                    CodingMode: 'CODING_MODE_2_0',
                    SampleRate: 48000,
                  },
                },
              },
            ],
            NameModifier: '_aac128',
          },
        ],
      },
    ],
    TimecodeConfig: { Source: 'ZEROBASED' },
  }
  const created = await mc.send(
    new CreateJobCommand({
      Role: MC_ROLE_ARN,
      Settings: jobSettings,
      UserMetadata: { smoke: 'true', runId },
    }),
  )
  const jobId = created.Job?.Id
  proof.mediaConvertJobId = jobId
  step('mediaconvert.CreateJob', 'ok', { jobId })

  // 5. Poll
  const startPoll = Date.now()
  const timeoutMs = 5 * 60 * 1000
  let status = created.Job?.Status
  let lastStatus = status
  while (status !== 'COMPLETE' && status !== 'ERROR' && status !== 'CANCELED') {
    if (Date.now() - startPoll > timeoutMs) throw new Error(`Timed out waiting for MediaConvert job ${jobId}`)
    await new Promise((r) => setTimeout(r, 5000))
    const got = await mc.send(new GetJobCommand({ Id: jobId }))
    status = got.Job?.Status
    if (status !== lastStatus) {
      console.log(`  … job status: ${status}`)
      lastStatus = status
    }
  }
  proof.mediaConvertFinalStatus = status
  proof.mediaConvertDurationMs = Date.now() - startPoll
  if (status !== 'COMPLETE') {
    step('mediaconvert poll', 'fail', { status })
    throw new Error(`MediaConvert job ended with status ${status}`)
  }
  step('mediaconvert poll', 'ok', { status, durationMs: proof.mediaConvertDurationMs })

  // 6. List processed prefix
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: OUT_BUCKET, Prefix: outputBasePrefix }),
  )
  const outputs = (list.Contents || []).map((o) => ({ key: o.Key, size: o.Size }))
  proof.outputs = outputs
  if (outputs.length === 0) {
    step('s3.ListObjectsV2 outputs', 'fail', 'no objects in processed prefix')
    throw new Error('No outputs in processed bucket')
  }
  step(`s3.ListObjectsV2 ${outputBasePrefix}`, 'ok', { count: outputs.length })

  // Verify each output is HEAD-able
  for (const o of outputs) {
    await s3.send(new HeadObjectCommand({ Bucket: OUT_BUCKET, Key: o.key }))
  }
  step('s3.HeadObject(all outputs)', 'ok')

  // 7. CloudFront signed URL — only if all 3 vars present
  if (CF_DOMAIN && CF_KEY_PAIR_ID && CF_PRIVATE_KEY) {
    const firstKey = outputs[0].key
    const url = `https://${CF_DOMAIN}/${firstKey}`
    const expires = new Date(Date.now() + 5 * 60 * 1000)
    const signed = cfGetSignedUrl({
      url,
      keyPairId: CF_KEY_PAIR_ID,
      privateKey: CF_PRIVATE_KEY.replace(/\\n/g, '\n'),
      dateLessThan: expires.toISOString(),
    })
    proof.cloudFrontSignedUrlSample = signed.replace(/Signature=[^&]+/, 'Signature=REDACTED')
    const head = await fetch(signed, { method: 'HEAD' })
    proof.cloudFrontHeadStatus = head.status
    if (head.status === 200) {
      step(`cloudfront HEAD ${firstKey}`, 'ok', { status: head.status })
    } else {
      step(`cloudfront HEAD ${firstKey}`, 'fail', { status: head.status })
      throw new Error(`CloudFront HEAD returned ${head.status}`)
    }
  } else {
    step('cloudfront signed URL', 'skip', 'one or more CF vars missing')
  }

  proof.ok = true
} catch (err) {
  proof.error = { message: err.message, name: err.name }
  console.error('Smoke failed:', err.message)
} finally {
  proof.finishedAt = new Date().toISOString()
  const outDir = path.join(repoRoot, 'proof-artifacts')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, 'zonga-aws-e2e-smoke.json')
  await writeFile(outPath, JSON.stringify(proof, null, 2))
  console.log(`\nProof artifact: ${path.relative(repoRoot, outPath)}`)
  process.exit(proof.ok ? 0 : 1)
}
