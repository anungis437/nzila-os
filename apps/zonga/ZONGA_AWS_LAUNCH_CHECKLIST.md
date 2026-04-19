# Zonga AWS Pre-Launch Checklist
**Date**: 2026-04-19 | **Status**: Setup Phase Complete

---

## ✅ Completed Tasks

### Infrastructure Provisioning
- [x] S3 Raw Media Bucket: `zonga-raw-media-ca`
- [x] S3 Processed Media Bucket: `zonga-processed-media-ca`
- [x] IAM MediaConvert Role: `zonga-mediaconvert-role`
- [x] S3 Permissions Attached to Role
- [x] Public Access Blocked on Both Buckets
- [x] MediaConvert Endpoint: `https://mediaconvert.ca-central-1.amazonaws.com`

### Configuration
- [x] Environment Variables Added to `apps/zonga/.env.local`
- [x] AWS Credentials Configured
- [x] S3 Bucket Names Set
- [x] MediaConvert Endpoint & Role ARN Set
- [x] IVS Default Settings Configured (LOW latency, STANDARD channel)
- [x] CloudFront TTL Set to 14400 seconds (4 hours)

### Documentation
- [x] AWS_ZONGA_SETUP.md (10-part comprehensive guide)
- [x] apps/zonga/.env.example (updated with AWS vars)
- [x] AWS validation script created

---

## 🔄 In Progress

### Manual Steps (Required Before Launch)

#### 1. CloudFront Distribution Setup
**Status**: ⚠️ PENDING MANUAL ACTION

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config '{...S3 origin, HTTPS-only...'

# Expected output: DistributionId, DomainName (d1234abcd.cloudfront.net)
```

**Add to .env.local:**
```
ZONGA_CLOUDFRONT_DOMAIN=<distribution-domain>
ZONGA_CLOUDFRONT_KEY_PAIR_ID=<key-pair-id>
ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM=<private-key-pem>
```

**Reference**: AWS_ZONGA_SETUP.md Part 4

---

#### 2. CloudFront Key Pair Creation
**Status**: ⚠️ PENDING MANUAL ACTION

```bash
# Generate RSA key pair
openssl genrsa -out /tmp/private-key.pem 2048
openssl rsa -in /tmp/private-key.pem -pubout -out /tmp/public-key.pem

# Create CloudFront key pair (requires public key base64)
base64 -i /tmp/public-key.pem | tr -d '\n'
aws cloudfront create-public-key --public-key-config '{...}'
```

**Reference**: AWS_ZONGA_SETUP.md Part 4

---

#### 3. MediaConvert Transcode Test
**Status**: ⚠️ PENDING VALIDATION

```bash
# Upload sample audio
ffmpeg -f lavfi -i "sine=frequency=440:duration=10" -acodec libmp3lame -q:a 9 /tmp/test.mp3
aws s3 cp /tmp/test.mp3 s3://zonga-raw-media-ca/test/

# Submit test transcode job
node apps/zonga/scripts/validate-aws-zonga.js
```

**Expected**: Job submitted, queued, and eventually completed in S3 output bucket

**Reference**: AWS_ZONGA_SETUP.md Part 7

---

#### 4. CloudFront Signed URL Test
**Status**: ⚠️ PENDING VALIDATION

After CloudFront + key pair setup:

```bash
# Test signed URL generation
node -c "
const { generateSignedUrl } = require('@nzila/zonga-streaming-aws/cloudfront-delivery');
const config = require('@nzila/zonga-streaming-aws').resolveCloudFrontConfig();
const url = generateSignedUrl(config, 'processed/test-asset/standard.m4a');
console.log('Signed URL:', url);
"

# Verify URL is accessible
curl -I $SIGNED_URL
# Expected: 200 OK
```

**Reference**: AWS_ZONGA_SETUP.md Part 8

---

## 🚀 Launch Readiness

### Pre-Flight Checklist (Before Going Live)

- [ ] CloudFront distribution created and enabled
- [ ] CloudFront key pair created and stored securely
- [ ] MediaConvert transcode test completed successfully
- [ ] CloudFront signed URL test successful
- [ ] `.env.local` fully populated with all 4 CloudFront variables
- [ ] Circuit breaker thresholds reviewed (default: 3-5 failures)
- [ ] S3 lifecycle policies confirmed (auto-cleanup after 7 days)
- [ ] Cost monitoring setup (estimate: $250-300/month for launch)
- [ ] Database backups verified
- [ ] Sentry error tracking configured
- [ ] Security: AWS credentials rotated and stored in secrets manager
- [ ] Documentation: Team briefed on launch constraints
  - Single client only
  - 500 tracks max
  - 100 concurrent listeners max
  - 200 MB upload limit (client)
  - 10 uploads/creator/day
  - Live streaming DISABLED

---

## 📊 Launch Configuration Summary

| Component | Status | Details |
|-----------|--------|---------|
| S3 Raw Bucket | ✅ Ready | `zonga-raw-media-ca` |
| S3 Processed Bucket | ✅ Ready | `zonga-processed-media-ca` |
| MediaConvert Role | ✅ Ready | `arn:aws:iam::706243848505:role/zonga-mediaconvert-role` |
| MediaConvert Endpoint | ✅ Ready | `https://mediaconvert.ca-central-1.amazonaws.com` |
| CloudFront Distribution | ⚠️ Manual | Pending creation |
| CloudFront Key Pair | ⚠️ Manual | Pending creation |
| IVS Live Channels | ⛔ Disabled | Deferred post-launch |
| Environment Variables | ✅ Partial | AWS vars set; CloudFront pending |

---

## 🔐 Security Checklist

- [x] Public access blocked on S3 buckets
- [x] IAM role created with least privilege
- [x] AWS credentials rotated and configured
- [x] No secrets in version control
- [ ] CloudFront key pair stored securely
- [ ] AWS credentials rotated regularly (plan: monthly)
- [ ] Access logs enabled on S3 buckets
- [ ] CloudTrail enabled for audit trail
- [ ] Secrets manager setup for production deployment

---

## 🎯 Next Steps (Priority Order)

1. **TODAY**: 
   - [ ] Create CloudFront distribution
   - [ ] Generate CloudFront key pair
   - [ ] Add CloudFront env vars to `.env.local`

2. **TOMORROW**:
   - [ ] Run MediaConvert transcode test
   - [ ] Run CloudFront signed URL test
   - [ ] Validate all circuit breakers
   - [ ] Run pre-flight checklist (Part 9)

3. **LAUNCH DAY**:
   - [ ] Final security audit
   - [ ] Cost monitoring enabled
   - [ ] Client onboarding call
   - [ ] Deploy to staging/production

---

## 📞 Support & Documentation

- **Setup Guide**: [AWS_ZONGA_SETUP.md](../../AWS_ZONGA_SETUP.md)
- **Streaming Readiness**: [reports/zonga-streaming-readiness.md](../../reports/zonga-streaming-readiness.md)
- **Launch Decision**: [reports/zonga-go-live-decision.md](../../reports/zonga-go-live-decision.md)
- **Validation Script**: `apps/zonga/scripts/validate-aws-zonga.js`

---

**Generated**: 2026-04-19 | **AWS Account**: 706243848505 | **Region**: ca-central-1
