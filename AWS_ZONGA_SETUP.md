# AWS Setup Guide for Zonga
**Date**: 2026-04-19 | **Status**: Implementation Guide for Client Launch

---

## Overview

Zonga requires three AWS services for media streaming:
1. **MediaConvert** — Audio transcoding (VOD)
2. **IVS** — Live streaming channels (deferred for launch)
3. **CloudFront** — CDN delivery with signed URLs
4. **S3** — Raw media storage and processed output

This guide provides step-by-step setup instructions for AWS account **706243848505**.

---

## Part 1: S3 Buckets (Foundation)

### Create S3 Buckets

```bash
# Raw audio uploads
aws s3api create-bucket \
  --bucket zonga-raw-media-ca \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1

# Processed/transcoded output
aws s3api create-bucket \
  --bucket zonga-processed-media-ca \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1
```

### Configure Lifecycle Policies (Auto-cleanup)

```bash
# Raw bucket: delete incomplete multipart uploads after 7 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket zonga-raw-media-ca \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "CleanupIncompleteUploads",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }]
  }'

# Processed bucket: transition old files to Glacier after 30 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket zonga-processed-media-ca \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "ArchiveOldMedia",
      "Status": "Enabled",
      "Transitions": [{
        "Days": 30,
        "StorageClass": "GLACIER"
      }],
      "Expiration": {
        "Days": 365
      }
    }]
  }'
```

### Block Public Access (Security)

```bash
aws s3api put-public-access-block \
  --bucket zonga-raw-media-ca \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-public-access-block \
  --bucket zonga-processed-media-ca \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## Part 2: IAM Role for MediaConvert

### Create MediaConvert Service Role

```bash
# Create assume policy JSON
cat > /tmp/mediaconvert-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "mediaconvert.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name ZongaMediaConvertRole \
  --assume-role-policy-document file:///tmp/mediaconvert-trust.json \
  --description "MediaConvert role for Zonga transcoding"

# Get the role ARN (save this — you'll need it)
ROLE_ARN=$(aws iam get-role --role-name ZongaMediaConvertRole --query 'Role.Arn' --output text)
echo "MediaConvert Role ARN: $ROLE_ARN"
```

### Attach S3 Permissions

```bash
# Create inline policy for S3 access
cat > /tmp/mediaconvert-s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::zonga-raw-media-ca/*",
        "arn:aws:s3:::zonga-raw-media-ca"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::zonga-processed-media-ca/*",
        "arn:aws:s3:::zonga-processed-media-ca"
      ]
    }
  ]
}
EOF

# Attach policy to role
aws iam put-role-policy \
  --role-name ZongaMediaConvertRole \
  --policy-name ZongaMediaConvertS3Access \
  --policy-document file:///tmp/mediaconvert-s3-policy.json
```

---

## Part 3: MediaConvert Queue & Job Settings

### Create MediaConvert Queue

```bash
# Get account-specific MediaConvert endpoint
# (Account ID: 706243848505, Region: ca-central-1)
aws mediaconvert describe-endpoints \
  --region ca-central-1 \
  --output text \
  --query 'Endpoints[0].Url'
```

Save this endpoint URL — you'll need it for environment config.

### Set Up Transcode Presets

MediaConvert uses **presets** (templates) for encoding. Zonga needs 4 quality tiers:

| Quality Tier | Codec | Bitrate | Use Case |
|---|---|---|---|
| `preview` | Opus | 32 kbps | Streaming preview |
| `standard` | AAC | 128 kbps | Standard playback |
| `high` | AAC | 256 kbps | Premium users |
| `hifi` | FLAC | 1411 kbps | Lossless (audiophiles) |

These are created programmatically by the `@nzila/zonga-streaming-aws/mediaconvert` module during job submission. No manual preset creation needed.

---

## Part 4: CloudFront Distribution (CDN)

### Create CloudFront Distribution

```bash
# Create distribution origin pointing to processed S3 bucket
cat > /tmp/cloudfront-config.json << 'EOF'
{
  "CallerReference": "zonga-launch-$(date +%s)",
  "Comment": "Zonga VOD streaming CDN",
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3Origin",
        "DomainName": "zonga-processed-media-ca.s3.ca-central-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3Origin",
    "ViewerProtocolPolicy": "https-only",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "WebACLId": ""
}
EOF

# Create distribution (this returns DistributionId and DomainName)
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --query 'Distribution.[Id,DomainName]' \
  --output text
```

**Save the CloudFront Domain Name** (e.g., `d1234abcd.cloudfront.net`)

### Create CloudFront Key Pair for Signed URLs

```bash
# Create a key pair (generates private + public key)
aws cloudfront create-public-key \
  --public-key-config '{
    "CallerReference": "zonga-keypair-'$(date +%s)'",
    "Name": "ZongaSignedUrlKey",
    "EncodedPublicKey": "MIIBIjANBg...base64EncodedPublicKey...",
    "Comment": "For Zonga signed URL generation"
  }'

# Note: You need to generate your own RSA key pair first:
openssl genrsa -out /tmp/private-key.pem 2048
openssl rsa -in /tmp/private-key.pem -pubout -out /tmp/public-key.pem

# Encode public key for API:
base64 -i /tmp/public-key.pem | tr -d '\n'
```

**Save**:
- Private key (PEM format) — goes in `ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM`
- Key Pair ID — returned by CloudFront API

---

## Part 5: IVS Live Streaming (Deferred — Post-Launch)

### Create IVS Channel (Optional for Launch)

```bash
# Create a channel for live streaming
aws ivs create-channel \
  --region ca-central-1 \
  --name "zonga-live-channel-1" \
  --channel-type STANDARD \
  --latency-mode LOW \
  --authorized-push-url-public false \
  --record-configuration-enabled true \
  --tags "Environment=staging,App=zonga" \
  --output json
```

This returns channel ID, ingest endpoint, and playback URL.

---

## Part 6: Environment Variables

### Update `.env.local` in `apps/zonga/`

```bash
# ── AWS Credentials (use IAM user or STS role) ──────────────────────────────
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>

# ── S3 Storage ──────────────────────────────────────────────────────────────
ZONGA_S3_RAW_BUCKET=zonga-raw-media-ca
ZONGA_S3_OUTPUT_BUCKET=zonga-processed-media-ca

# ── MediaConvert ────────────────────────────────────────────────────────────
# Get endpoint from: aws mediaconvert describe-endpoints --region ca-central-1
ZONGA_MEDIACONVERT_ENDPOINT=https://[account-specific].mediaconvert.ca-central-1.amazonaws.com
ZONGA_MEDIACONVERT_ROLE_ARN=arn:aws:iam::706243848505:role/ZongaMediaConvertRole
ZONGA_MEDIACONVERT_OUTPUT_PREFIX=processed/

# ── CloudFront CDN ──────────────────────────────────────────────────────────
ZONGA_CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
ZONGA_CLOUDFRONT_KEY_PAIR_ID=APKAJ...
ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM='-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
ZONGA_CLOUDFRONT_TTL_SEC=14400

# ── IVS Live (Optional — post-launch) ───────────────────────────────────────
ZONGA_IVS_LATENCY_MODE=LOW
ZONGA_IVS_CHANNEL_TYPE=STANDARD
# (Channel ID stored in DB when provisioning)
```

⚠️ **WARNING**: Store sensitive keys in AWS Secrets Manager or GitHub Secrets, not in version control.

---

## Part 7: Test MediaConvert (Pre-Launch Validation)

### Submit Test Transcode Job

```bash
# Use the media-job-service to submit a test job
cd apps/zonga

# Create a test audio file
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -acodec libmp3lame -q:a 9 /tmp/test-audio.mp3

# Upload to S3
aws s3 cp /tmp/test-audio.mp3 s3://zonga-raw-media-ca/test/

# Submit transcode job
node -e "
const { submitMediaConvertJob } = require('@nzila/zonga-streaming-aws/mediaconvert');
submitMediaConvertJob({
  contentAssetId: 'test-asset-001',
  orgId: 'test-org',
  inputS3Key: 'test/test-audio.mp3',
  qualities: ['preview', 'standard', 'high', 'hifi']
}).then(job => console.log('Job submitted:', job.jobId))
  .catch(err => console.error('Error:', err));
"
```

Monitor job progress in MediaConvert console (AWS Web UI).

---

## Part 8: Test CloudFront Signed URL (Pre-Launch Validation)

```bash
# Generate signed URL
cd apps/zonga

node -e "
const { generateSignedUrl } = require('@nzila/zonga-streaming-aws/cloudfront-delivery');
const config = require('@nzila/zonga-streaming-aws').resolveCloudFrontConfig();

const url = generateSignedUrl(config, 'processed/test-asset-001/standard.m4a');
console.log('Signed URL:', url);

// Test with curl
" && curl -I $(curl ... see output)
```

Should return `200 OK` if signed URL is valid and content exists.

---

## Part 9: Pre-Launch Checklist

- [ ] S3 buckets created (`zonga-raw-media-ca`, `zonga-processed-media-ca`)
- [ ] IAM MediaConvert role created and trusted
- [ ] MediaConvert endpoint URL retrieved
- [ ] CloudFront distribution created and enabled
- [ ] CloudFront key pair created (public + private key)
- [ ] All environment variables set in `.env.local`
- [ ] Test transcode job submitted and completed
- [ ] Test signed URL generated and playable
- [ ] Circuit breaker thresholds reviewed (see `features/media/resilience.ts`)
- [ ] IVS deferred (NOT enabled for launch)
- [ ] Backup strategy documented (see `reports/zonga-backup-ir-plan.md`)

---

## Part 10: Monitoring & Observability

### CloudWatch Metrics to Watch

```bash
# MediaConvert job completion rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/MediaConvert \
  --metric-name JobsCompleted \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# S3 request metrics
aws s3api get-bucket-request-payment \
  --bucket zonga-processed-media-ca

# CloudFront cache hit rate (from console)
```

### Cost Estimation (Launch Constraints)

| Service | Usage | Est. Cost/month |
|---|---|---|
| S3 Storage | 500 tracks × 50 MB avg | $12 |
| MediaConvert | 500 tracks × 4 minutes avg transcode | $200 |
| CloudFront | 100 concurrent listeners × 100 kbps | $30–60 |
| **Total** | First client launch | **$250–300** |

Monitor after week 1 and adjust capacity/limits accordingly.

---

## References

- [AWS MediaConvert API](https://docs.aws.amazon.com/mediaconvert/latest/ug/what-is.html)
- [AWS IVS Getting Started](https://docs.aws.amazon.com/ivs/latest/userguide/getting-started.html)
- [CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [Zonga Streaming Code](packages/zonga-streaming-aws/)
- [Zonga Launch Readiness Report](reports/zonga-launch-readiness.md)

---

*Last Updated: 2026-04-19*
