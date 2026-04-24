#!/usr/bin/env node
/**
 * One-shot remediation for CloudFront origin misconfiguration:
 *   Distribution E3ASNK7MK51C7Y origin points at zonga-raw-media-ca
 *   instead of zonga-processed-media-ca, so signed URLs for processed/*
 *   return 403.
 *
 * Steps (idempotent):
 *   1. GetDistributionConfig → mutate origin DomainName + Id → UpdateDistribution.
 *   2. Ensure processed bucket policy grants OAC service principal read.
 *   3. CreateInvalidation /*.
 *   4. Poll until Status === 'Deployed'.
 *
 * Run from packages/zonga-streaming-aws so AWS SDK deps resolve:
 *   node --env-file=../../apps/zonga/.env.local scripts/fix-cloudfront-origin.mjs
 */
import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  GetDistributionCommand,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront'
import {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

const region = process.env.AWS_REGION || 'ca-central-1'
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}
const distributionId = process.env.ZONGA_CLOUDFRONT_DISTRIBUTION_ID
const processedBucket = process.env.ZONGA_S3_OUTPUT_BUCKET
const rawBucket = process.env.ZONGA_S3_RAW_BUCKET
const expectedDomain = `${processedBucket}.s3.${region}.amazonaws.com`

if (!distributionId || !processedBucket) {
  console.error('Missing ZONGA_CLOUDFRONT_DISTRIBUTION_ID or ZONGA_S3_OUTPUT_BUCKET')
  process.exit(2)
}

const cf = new CloudFrontClient({ region: 'us-east-1', credentials })
const s3 = new S3Client({ region, credentials })

console.log(`Distribution:     ${distributionId}`)
console.log(`Target origin:    ${expectedDomain}`)
console.log(`Processed bucket: ${processedBucket}\n`)

const cfg = await cf.send(new GetDistributionConfigCommand({ Id: distributionId }))
const dc = cfg.DistributionConfig
const origin = dc.Origins.Items[0]
console.log(`Current origin DomainName: ${origin.DomainName}`)
console.log(`Current origin Id:         ${origin.Id}`)
console.log(`OriginAccessControlId:     ${origin.OriginAccessControlId || '(none)'}\n`)

if (origin.DomainName === expectedDomain) {
  console.log('OK origin already targets the processed bucket — skipping update.')
} else {
  origin.DomainName = expectedDomain
  if (origin.Id && origin.Id.includes(rawBucket)) {
    origin.Id = origin.Id.replace(rawBucket, processedBucket)
  }
  if (dc.DefaultCacheBehavior.TargetOriginId.includes(rawBucket)) {
    dc.DefaultCacheBehavior.TargetOriginId = dc.DefaultCacheBehavior.TargetOriginId.replace(
      rawBucket,
      processedBucket,
    )
  }
  const updated = await cf.send(
    new UpdateDistributionCommand({
      Id: distributionId,
      IfMatch: cfg.ETag,
      DistributionConfig: dc,
    }),
  )
  console.log(`OK UpdateDistribution accepted. New ETag: ${updated.ETag}`)
}

const oacId = origin.OriginAccessControlId
if (!oacId) {
  console.warn('WARN: origin has no OriginAccessControlId — skipping bucket policy step.')
} else {
  const accountId = (process.env.ZONGA_MEDIACONVERT_ROLE_ARN.match(/iam::(\d+):/) || [])[1]
  const sid = 'AllowCloudFrontServicePrincipalReadOnly'
  const requiredStatement = {
    Sid: sid,
    Effect: 'Allow',
    Principal: { Service: 'cloudfront.amazonaws.com' },
    Action: 's3:GetObject',
    Resource: `arn:aws:s3:::${processedBucket}/*`,
    Condition: {
      StringEquals: {
        'AWS:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`,
      },
    },
  }
  let existing = null
  try {
    const res = await s3.send(new GetBucketPolicyCommand({ Bucket: processedBucket }))
    existing = JSON.parse(res.Policy)
  } catch (err) {
    if (err.name === 'NoSuchBucketPolicy') existing = null
    else throw err
  }
  const newPolicy = existing ?? { Version: '2012-10-17', Statement: [] }
  const idx = newPolicy.Statement.findIndex((s) => s.Sid === sid)
  const same =
    idx >= 0 && JSON.stringify(newPolicy.Statement[idx]) === JSON.stringify(requiredStatement)
  if (same) {
    console.log(`OK bucket policy on ${processedBucket} already grants OAC access.`)
  } else {
    if (idx >= 0) newPolicy.Statement[idx] = requiredStatement
    else newPolicy.Statement.push(requiredStatement)
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: processedBucket,
        Policy: JSON.stringify(newPolicy),
      }),
    )
    console.log(`OK bucket policy on ${processedBucket} updated to grant OAC ${oacId}.`)
  }
}

const inv = await cf.send(
  new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: `fix-origin-${Date.now()}`,
      Paths: { Quantity: 1, Items: ['/*'] },
    },
  }),
)
console.log(`OK invalidation created: ${inv.Invalidation.Id}`)

const deadline = Date.now() + 25 * 60 * 1000
let lastStatus = ''
console.log('\nWaiting for distribution to redeploy…')
for (;;) {
  const got = await cf.send(new GetDistributionCommand({ Id: distributionId }))
  const status = got.Distribution.Status
  if (status !== lastStatus) {
    console.log(`  status: ${status}`)
    lastStatus = status
  }
  if (status === 'Deployed') break
  if (Date.now() > deadline) {
    console.error('TIMEOUT waiting for Deployed status.')
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 30_000))
}
console.log('OK Distribution Deployed.')
