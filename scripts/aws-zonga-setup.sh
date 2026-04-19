#!/usr/bin/env bash
# AWS Setup Script for Zonga
# Usage: bash ./scripts/aws-zonga-setup.sh

set -e

REGION="ca-central-1"
ACCOUNT_ID="706243848505"
PREFIX="zonga"

echo "🚀 Zonga AWS Setup — Starting"
echo "Region: $REGION | Account: $ACCOUNT_ID"
echo ""

# ── Part 1: S3 Buckets ───────────────────────────────────────────────────────
echo "📦 Creating S3 buckets..."

RAW_BUCKET="${PREFIX}-raw-media-ca"
PROCESSED_BUCKET="${PREFIX}-processed-media-ca"

aws s3api create-bucket \
  --bucket "$RAW_BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || echo "ℹ️  Bucket $RAW_BUCKET already exists"

aws s3api create-bucket \
  --bucket "$PROCESSED_BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || echo "ℹ️  Bucket $PROCESSED_BUCKET already exists"

echo "✅ S3 buckets ready"
echo "   - Raw: s3://$RAW_BUCKET/"
echo "   - Processed: s3://$PROCESSED_BUCKET/"
echo ""

# ── Part 2: Block Public Access ──────────────────────────────────────────────
echo "🔒 Blocking public access..."

for bucket in "$RAW_BUCKET" "$PROCESSED_BUCKET"; do
  aws s3api put-public-access-block \
    --bucket "$bucket" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
    2>/dev/null || echo "ℹ️  Public access block already set for $bucket"
done

echo "✅ Public access blocked"
echo ""

# ── Part 3: IAM Role for MediaConvert ────────────────────────────────────────
echo "🔐 Creating IAM role for MediaConvert..."

ROLE_NAME="${PREFIX}-mediaconvert-role"

# Create assume policy
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

aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file:///tmp/mediaconvert-trust.json \
  --description "MediaConvert role for $PREFIX transcoding" 2>/dev/null || echo "ℹ️  Role $ROLE_NAME already exists"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
echo "✅ IAM role ready: $ROLE_ARN"
echo ""

# ── Part 4: Attach S3 Permissions ────────────────────────────────────────────
echo "📋 Attaching S3 permissions to MediaConvert role..."

cat > /tmp/mediaconvert-s3-policy.json << EOF
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
        "arn:aws:s3:::${RAW_BUCKET}/*",
        "arn:aws:s3:::${RAW_BUCKET}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${PROCESSED_BUCKET}/*",
        "arn:aws:s3:::${PROCESSED_BUCKET}"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "${PREFIX}-mediaconvert-s3-access" \
  --policy-document file:///tmp/mediaconvert-s3-policy.json 2>/dev/null || echo "ℹ️  S3 policy already attached"

echo "✅ S3 permissions attached"
echo ""

# ── Part 5: Get MediaConvert Endpoint ────────────────────────────────────────
echo "🎬 Getting MediaConvert endpoint..."

MEDIACONVERT_ENDPOINT=$(aws mediaconvert describe-endpoints \
  --region "$REGION" \
  --output text \
  --query 'Endpoints[0].Url' || echo "ERROR_RETRIEVING_ENDPOINT")

echo "✅ MediaConvert endpoint:"
echo "   $MEDIACONVERT_ENDPOINT"
echo ""

# ── Part 6: Summary ──────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ AWS Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Add these to apps/zonga/.env.local:"
echo ""
echo "# AWS Credentials"
echo "AWS_REGION=$REGION"
echo "AWS_ACCESS_KEY_ID=<your-access-key>"
echo "AWS_SECRET_ACCESS_KEY=<your-secret-key>"
echo ""
echo "# S3 Storage"
echo "ZONGA_S3_RAW_BUCKET=$RAW_BUCKET"
echo "ZONGA_S3_OUTPUT_BUCKET=$PROCESSED_BUCKET"
echo ""
echo "# MediaConvert"
echo "ZONGA_MEDIACONVERT_ENDPOINT=$MEDIACONVERT_ENDPOINT"
echo "ZONGA_MEDIACONVERT_ROLE_ARN=$ROLE_ARN"
echo "ZONGA_MEDIACONVERT_OUTPUT_PREFIX=processed/"
echo ""
echo "# CloudFront (manual step — see AWS_ZONGA_SETUP.md Part 4)"
echo "ZONGA_CLOUDFRONT_DOMAIN=<your-distribution-domain>"
echo "ZONGA_CLOUDFRONT_KEY_PAIR_ID=<your-key-pair-id>"
echo "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM=<private-key-pem>"
echo "ZONGA_CLOUDFRONT_TTL_SEC=14400"
echo ""
echo "📖 For detailed setup steps, see: AWS_ZONGA_SETUP.md"
echo "🔗 See also: reports/zonga-streaming-readiness.md"
echo ""
