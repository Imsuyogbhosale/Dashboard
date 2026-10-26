const { S3Client } = require('@aws-sdk/client-s3');

let cachedClient;

function getS3Config() {
  const { AWS_REGION, S3_BUCKET_NAME } = process.env;
  if (!AWS_REGION || !S3_BUCKET_NAME) {
    const error = new Error('Set AWS_REGION and S3_BUCKET_NAME in .env to enable profile photo uploads.');
    error.status = 503;
    throw error;
  }

  return { region: AWS_REGION, bucket: S3_BUCKET_NAME };
}

function getS3Client() {
  const { region } = getS3Config();
  if (cachedClient) return cachedClient;

  const endpoint = process.env.S3_ENDPOINT || undefined;
  cachedClient = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return cachedClient;
}

module.exports = { getS3Config, getS3Client };
