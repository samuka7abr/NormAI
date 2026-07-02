#!/bin/sh
set -eu

BUCKET="${AWS_S3_BUCKET_NAME:-normalizador-local}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

echo "Creating LocalStack S3 bucket: ${BUCKET}"

if awslocal s3api head-bucket --bucket "${BUCKET}" >/dev/null 2>&1; then
  echo "Bucket already exists: ${BUCKET}"
  exit 0
fi

if [ "${REGION}" = "us-east-1" ]; then
  awslocal s3api create-bucket --bucket "${BUCKET}" --region "${REGION}"
else
  awslocal s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi

echo "LocalStack S3 bucket ready: ${BUCKET}"
