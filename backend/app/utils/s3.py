"""
S3 integration for report storage and file exports.
Falls back to local filesystem when S3 is not configured.
"""
import os
import logging
from io import BytesIO
from datetime import datetime

logger = logging.getLogger("finsurge.s3")

_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client:
        return _s3_client
    try:
        import boto3
        from app.config import settings
        _s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
        return _s3_client
    except Exception as e:
        logger.warning(f"S3 client init failed: {e}")
        return None


def upload_report(content: bytes, filename: str, content_type: str = "application/pdf") -> str:
    """Upload a report to S3. Returns the S3 key or local path."""
    from app.config import settings

    date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
    key = f"reports/{date_prefix}/{filename}"

    if settings.S3_REPORTS_BUCKET:
        s3 = _get_s3()
        if s3:
            s3.put_object(
                Bucket=settings.S3_REPORTS_BUCKET,
                Key=key,
                Body=content,
                ContentType=content_type,
                ServerSideEncryption="aws:kms",
            )
            logger.info(f"Uploaded report to s3://{settings.S3_REPORTS_BUCKET}/{key}")
            return f"s3://{settings.S3_REPORTS_BUCKET}/{key}"

    # Fallback: local filesystem
    local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "exports", date_prefix)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    with open(local_path, "wb") as f:
        f.write(content)
    logger.info(f"Saved report locally: {local_path}")
    return local_path


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a pre-signed URL for downloading a report from S3."""
    from app.config import settings

    if not settings.S3_REPORTS_BUCKET:
        return ""

    s3 = _get_s3()
    if not s3:
        return ""

    # Strip s3:// prefix if present
    if key.startswith("s3://"):
        key = key.split("/", 3)[3]

    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_REPORTS_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


def list_reports(prefix: str = "reports/", max_keys: int = 100) -> list[dict]:
    """List reports in S3 bucket."""
    from app.config import settings

    if not settings.S3_REPORTS_BUCKET:
        return []

    s3 = _get_s3()
    if not s3:
        return []

    resp = s3.list_objects_v2(
        Bucket=settings.S3_REPORTS_BUCKET,
        Prefix=prefix,
        MaxKeys=max_keys,
    )

    return [
        {
            "key": obj["Key"],
            "size": obj["Size"],
            "last_modified": obj["LastModified"].isoformat(),
        }
        for obj in resp.get("Contents", [])
    ]
