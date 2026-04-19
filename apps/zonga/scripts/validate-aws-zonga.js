#!/usr/bin/env node
/**
 * AWS Zonga Configuration Validator
 * Tests AWS connectivity and MediaConvert readiness
 *
 * Usage: node scripts/validate-aws-zonga.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const config = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

AWS.config.update(config);

const s3 = new AWS.S3();
const iam = new AWS.IAM();
const mediaconvert = new AWS.MediaConvert({ endpoint: process.env.ZONGA_MEDIACONVERT_ENDPOINT });

async function validate() {
  console.log('🚀 AWS Zonga Configuration Validator\n');
  
  const results = {
    passed: [],
    failed: [],
  };

  // Test 1: AWS Credentials
  try {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    console.log(`✅ AWS Credentials: Account ${identity.Account}`);
    results.passed.push('AWS Credentials');
  } catch (err) {
    console.log(`❌ AWS Credentials: ${err.message}`);
    results.failed.push('AWS Credentials');
  }

  // Test 2: S3 Raw Bucket
  try {
    const rawBucket = process.env.ZONGA_S3_RAW_BUCKET;
    await s3.headBucket({ Bucket: rawBucket }).promise();
    console.log(`✅ S3 Raw Bucket: ${rawBucket} exists`);
    results.passed.push('S3 Raw Bucket');
  } catch (err) {
    console.log(`❌ S3 Raw Bucket: ${err.message}`);
    results.failed.push('S3 Raw Bucket');
  }

  // Test 3: S3 Processed Bucket
  try {
    const processedBucket = process.env.ZONGA_S3_OUTPUT_BUCKET;
    await s3.headBucket({ Bucket: processedBucket }).promise();
    console.log(`✅ S3 Processed Bucket: ${processedBucket} exists`);
    results.passed.push('S3 Processed Bucket');
  } catch (err) {
    console.log(`❌ S3 Processed Bucket: ${err.message}`);
    results.failed.push('S3 Processed Bucket');
  }

  // Test 4: IAM Role
  try {
    const roleArn = process.env.ZONGA_MEDIACONVERT_ROLE_ARN;
    const roleName = roleArn.split('/').pop();
    await iam.getRole({ RoleName: roleName }).promise();
    console.log(`✅ IAM Role: ${roleName} exists`);
    results.passed.push('IAM Role');
  } catch (err) {
    console.log(`❌ IAM Role: ${err.message}`);
    results.failed.push('IAM Role');
  }

  // Test 5: MediaConvert Endpoint
  try {
    const queues = await mediaconvert.listQueues({}).promise();
    console.log(`✅ MediaConvert: Connected (${queues.Queues.length} queue(s))`);
    results.passed.push('MediaConvert');
  } catch (err) {
    console.log(`❌ MediaConvert: ${err.message}`);
    results.failed.push('MediaConvert');
  }

  // Summary
  console.log('\n════════════════════════════════════');
  console.log(`Passed: ${results.passed.length}/${results.passed.length + results.failed.length}`);
  console.log('════════════════════════════════════\n');

  if (results.failed.length > 0) {
    console.log('❌ Failed Tests:');
    results.failed.forEach((test) => console.log(`  - ${test}`));
    process.exit(1);
  } else {
    console.log('✅ All tests passed! AWS Zonga is ready for launch.');
    console.log('\nNext steps:');
    console.log('  1. Set up CloudFront distribution (manual, see AWS_ZONGA_SETUP.md Part 4)');
    console.log('  2. Add CloudFront env vars to .env.local');
    console.log('  3. Run test transcode (see AWS_ZONGA_SETUP.md Part 7)');
    console.log('  4. Run pre-flight checklist (see AWS_ZONGA_SETUP.md Part 9)\n');
    process.exit(0);
  }
}

validate().catch((err) => {
  console.error('Validator error:', err);
  process.exit(1);
});
