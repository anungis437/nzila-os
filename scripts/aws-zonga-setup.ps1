# AWS Setup for Zonga (PowerShell)
# Provisions: S3, IAM role for MediaConvert, gets endpoint

$Region = "ca-central-1"
$Prefix = "zonga"
$RawBucket = "$Prefix-raw-media-ca"
$ProcessedBucket = "$Prefix-processed-media-ca"
$RoleName = "$Prefix-mediaconvert-role"

Write-Host "======================================"
Write-Host "Zonga AWS Setup" -ForegroundColor Green
Write-Host "======================================"
Write-Host "Region: $Region"
Write-Host ""

# Part 1: S3 Buckets
Write-Host "Creating S3 buckets..." -ForegroundColor Cyan
aws s3api create-bucket --bucket $RawBucket --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null
aws s3api create-bucket --bucket $ProcessedBucket --region $Region --create-bucket-configuration LocationConstraint=$Region 2>$null
Write-Host "✅ S3 buckets ready" -ForegroundColor Green
Write-Host "   Raw: $RawBucket"
Write-Host "   Processed: $ProcessedBucket"
Write-Host ""

# Part 2: Block Public Access
Write-Host "Blocking public access..." -ForegroundColor Cyan
foreach ($bucket in @($RawBucket, $ProcessedBucket)) {
    aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" 2>$null
}
Write-Host "✅ Public access blocked" -ForegroundColor Green
Write-Host ""

# Part 3: IAM Role for MediaConvert
Write-Host "Creating IAM role..." -ForegroundColor Cyan

$trustPolicyJson = @"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "mediaconvert.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
"@

$trustFile = "$env:TEMP\trust-policy.json"
[System.IO.File]::WriteAllText($trustFile, $trustPolicyJson)
aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustFile" --description "MediaConvert role for Zonga" 2>$null
Remove-Item $trustFile

$RoleArn = aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text
Write-Host "✅ IAM role created" -ForegroundColor Green
Write-Host "   ARN: $RoleArn"
Write-Host ""

# Part 4: Attach S3 Permissions
Write-Host "Attaching S3 permissions..." -ForegroundColor Cyan

$s3PolicyJson = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$RawBucket/*", "arn:aws:s3:::$RawBucket"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$ProcessedBucket/*", "arn:aws:s3:::$ProcessedBucket"]
    }
  ]
}
"@

$s3File = "$env:TEMP\s3-policy.json"
[System.IO.File]::WriteAllText($s3File, $s3PolicyJson)
aws iam put-role-policy --role-name $RoleName --policy-name "$Prefix-mediaconvert-s3-access" --policy-document "file://$s3File" 2>$null
Remove-Item $s3File

Write-Host "✅ S3 permissions attached" -ForegroundColor Green
Write-Host ""

# Part 5: Get MediaConvert Endpoint
Write-Host "Getting MediaConvert endpoint..." -ForegroundColor Cyan
$MCEndpoint = aws mediaconvert describe-endpoints --region $Region --query 'Endpoints[0].Url' --output text
Write-Host "✅ MediaConvert endpoint:" -ForegroundColor Green
Write-Host "   $MCEndpoint"
Write-Host ""

# Part 6: Summary
Write-Host "======================================"
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "======================================"
Write-Host ""
Write-Host "Add to apps/zonga/.env.local:" -ForegroundColor Yellow
Write-Host ""
Write-Host "AWS_REGION=$Region"
Write-Host "AWS_ACCESS_KEY_ID=<your-access-key>"
Write-Host "AWS_SECRET_ACCESS_KEY=<your-secret-key>"
Write-Host ""
Write-Host "ZONGA_S3_RAW_BUCKET=$RawBucket"
Write-Host "ZONGA_S3_OUTPUT_BUCKET=$ProcessedBucket"
Write-Host ""
Write-Host "ZONGA_MEDIACONVERT_ENDPOINT=$MCEndpoint"
Write-Host "ZONGA_MEDIACONVERT_ROLE_ARN=$RoleArn"
Write-Host "ZONGA_MEDIACONVERT_OUTPUT_PREFIX=processed/"
Write-Host ""
Write-Host "ZONGA_CLOUDFRONT_DOMAIN=<manual-setup>"
Write-Host "ZONGA_CLOUDFRONT_KEY_PAIR_ID=<manual-setup>"
Write-Host "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM=<manual-setup>"
Write-Host "ZONGA_CLOUDFRONT_TTL_SEC=14400"
Write-Host ""
Write-Host "See AWS_ZONGA_SETUP.md for detailed steps" -ForegroundColor Cyan
Write-Host ""
# AWS Setup Script for Zonga (PowerShell)
# Usage: .\scripts\aws-zonga-setup.ps1

param(
    [string]$Region = "ca-central-1",
    [string]$AccountId = "706243848505",
    [string]$Prefix = "zonga"
)

$ErrorActionPreference = "Continue"

Write-Host "🚀 Zonga AWS Setup — Starting" -ForegroundColor Green
Write-Host "Region: $Region | Account: $AccountId"
Write-Host ""

# ── Part 1: S3 Buckets ───────────────────────────────────────────────────────
Write-Host "📦 Creating S3 buckets..." -ForegroundColor Cyan

$RawBucket = "$Prefix-raw-media-ca"
$ProcessedBucket = "$Prefix-processed-media-ca"

try {
    aws s3api create-bucket `
        --bucket $RawBucket `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region 2>$null
    Write-Host "✅ Created bucket: $RawBucket"
} catch {
    Write-Host "ℹ️  Bucket $RawBucket already exists" -ForegroundColor Yellow
}

try {
    aws s3api create-bucket `
        --bucket $ProcessedBucket `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region 2>$null
    Write-Host "✅ Created bucket: $ProcessedBucket"
} catch {
    Write-Host "ℹ️  Bucket $ProcessedBucket already exists" -ForegroundColor Yellow
}

Write-Host "✅ S3 buckets ready"
Write-Host "   - Raw: s3://$RawBucket/"
Write-Host "   - Processed: s3://$ProcessedBucket/"
Write-Host ""

# ── Part 2: Block Public Access ──────────────────────────────────────────────
Write-Host "🔒 Blocking public access..." -ForegroundColor Cyan

$buckets = @($RawBucket, $ProcessedBucket)
foreach ($bucket in $buckets) {
    try {
        aws s3api put-public-access-block `
            --bucket $bucket `
            --public-access-block-configuration `
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" 2>$null
        Write-Host "✅ Public access blocked for: $bucket"
    } catch {
        Write-Host "ℹ️  Public access block already set for $bucket" -ForegroundColor Yellow
    }
}

Write-Host ""

# ── Part 3: IAM Role for MediaConvert ────────────────────────────────────────
Write-Host "🔐 Creating IAM role for MediaConvert..." -ForegroundColor Cyan

$RoleName = "$Prefix-mediaconvert-role"

# Create assume policy (as JSON string)
$trustPolicy = @"
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
"@

$trustPolicyFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($trustPolicyFile, $trustPolicy, [System.Text.Encoding]::UTF8)

try {
    aws iam create-role `
        --role-name $RoleName `
        --assume-role-policy-document file://$trustPolicyFile `
        --description "MediaConvert role for $Prefix transcoding" 2>$null
    Write-Host "✅ Created IAM role: $RoleName"
} catch {
    Write-Host "ℹ️  Role $RoleName already exists" -ForegroundColor Yellow
}

$RoleArn = aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text
Write-Host "✅ IAM role ready: $RoleArn"
Write-Host ""

# ── Part 4: Attach S3 Permissions ────────────────────────────────────────────
Write-Host "📋 Attaching S3 permissions to MediaConvert role..." -ForegroundColor Cyan

$s3Policy = @"
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
        "arn:aws:s3:::$RawBucket/*",
        "arn:aws:s3:::$RawBucket"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::$ProcessedBucket/*",
        "arn:aws:s3:::$ProcessedBucket"
      ]
    }
  ]
}
"@

$s3PolicyFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($s3PolicyFile, $s3Policy, [System.Text.Encoding]::UTF8)

try {
    aws iam put-role-policy `
        --role-name $RoleName `
        --policy-name "$Prefix-mediaconvert-s3-access" `
        --policy-document file://$s3PolicyFile 2>$null
    Write-Host "✅ S3 permissions attached"
} catch {
    Write-Host "ℹ️  S3 policy already attached" -ForegroundColor Yellow
}

Write-Host ""

# ── Part 5: Get MediaConvert Endpoint ────────────────────────────────────────
Write-Host "🎬 Getting MediaConvert endpoint..." -ForegroundColor Cyan

$MediaConvertEndpoint = aws mediaconvert describe-endpoints `
    --region $Region `
    --output text `
    --query 'Endpoints[0].Url'

Write-Host "✅ MediaConvert endpoint:"
Write-Host "   $MediaConvertEndpoint"
Write-Host ""

# ── Part 6: Summary ──────────────────────────────────────────────────────────
Write-Host "========================================" -ForegroundColor Green
Write-Host "✨ AWS Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Environment variables to add to apps/zonga/.env.local:" -ForegroundColor Yellow
Write-Host ""
Write-Host "# AWS Credentials"
Write-Host "AWS_REGION=$Region"
Write-Host "AWS_ACCESS_KEY_ID=<your-access-key>"
Write-Host "AWS_SECRET_ACCESS_KEY=<your-secret-key>"
Write-Host ""
Write-Host "# S3 Storage"
Write-Host "ZONGA_S3_RAW_BUCKET=$RawBucket"
Write-Host "ZONGA_S3_OUTPUT_BUCKET=$ProcessedBucket"
Write-Host ""
Write-Host "# MediaConvert"
Write-Host "ZONGA_MEDIACONVERT_ENDPOINT=$MediaConvertEndpoint"
Write-Host "ZONGA_MEDIACONVERT_ROLE_ARN=$RoleArn"
Write-Host "ZONGA_MEDIACONVERT_OUTPUT_PREFIX=processed/"
Write-Host ""
Write-Host "# CloudFront (manual setup - see AWS_ZONGA_SETUP.md Part 4)"
Write-Host "ZONGA_CLOUDFRONT_DOMAIN=<your-distribution-domain>"
Write-Host "ZONGA_CLOUDFRONT_KEY_PAIR_ID=<your-key-pair-id>"
Write-Host "ZONGA_CLOUDFRONT_PRIVATE_KEY_PEM=<private-key-pem>"
Write-Host "ZONGA_CLOUDFRONT_TTL_SEC=14400"
Write-Host ""
Write-Host "Documentation: AWS_ZONGA_SETUP.md" -ForegroundColor Cyan
Write-Host ""

# Cleanup
Remove-Item -Path $trustPolicyFile -Force -ErrorAction SilentlyContinue
Remove-Item -Path $s3PolicyFile -Force -ErrorAction SilentlyContinue
