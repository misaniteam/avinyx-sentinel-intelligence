from aiobotocore.session import get_session
from sentinel_shared.config import get_settings


class S3Client:
    def __init__(self):
        self.settings = get_settings()
        self._session = get_session()

    def _get_client_kwargs(self):
        kwargs = {"region_name": self.settings.aws_region}
        if self.settings.aws_endpoint_url:
            kwargs["endpoint_url"] = self.settings.aws_endpoint_url
        return kwargs

    async def upload_file(
        self, bucket: str, key: str, data: bytes, content_type: str
    ) -> str:
        """Upload a file to S3 and return the key."""
        async with self._session.create_client(
            "s3", **self._get_client_kwargs()
        ) as client:
            await client.put_object(
                Bucket=bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                ServerSideEncryption="AES256",
            )
            return key

    async def download_file(self, bucket: str, key: str) -> bytes:
        """Download a file from S3 and return its bytes."""
        async with self._session.create_client(
            "s3", **self._get_client_kwargs()
        ) as client:
            resp = await client.get_object(Bucket=bucket, Key=key)
            async with resp["Body"] as stream:
                return await stream.read()
