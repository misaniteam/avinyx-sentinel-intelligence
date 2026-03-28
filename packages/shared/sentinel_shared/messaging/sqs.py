import json
from aiobotocore.session import get_session
from sentinel_shared.config import get_settings


class SQSClient:
    def __init__(self):
        self.settings = get_settings()
        self._session = get_session()

    def _get_client_kwargs(self):
        kwargs = {"region_name": self.settings.aws_region}
        if self.settings.aws_endpoint_url:
            kwargs["endpoint_url"] = self.settings.aws_endpoint_url
        return kwargs

    async def send_message(self, queue_name: str, message: dict) -> str:
        async with self._session.create_client(
            "sqs", **self._get_client_kwargs()
        ) as client:
            queue_url_resp = await client.get_queue_url(QueueName=queue_name)
            queue_url = queue_url_resp["QueueUrl"]
            resp = await client.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps(message),
            )
            return resp["MessageId"]

    async def receive_messages(
        self,
        queue_name: str,
        max_messages: int = 10,
        wait_time: int = 20,
        visibility_timeout: int | None = None,
    ) -> list:
        async with self._session.create_client(
            "sqs", **self._get_client_kwargs()
        ) as client:
            queue_url_resp = await client.get_queue_url(QueueName=queue_name)
            queue_url = queue_url_resp["QueueUrl"]
            kwargs = {
                "QueueUrl": queue_url,
                "MaxNumberOfMessages": max_messages,
                "WaitTimeSeconds": wait_time,
            }
            if visibility_timeout is not None:
                kwargs["VisibilityTimeout"] = visibility_timeout
            resp = await client.receive_message(**kwargs)
            return resp.get("Messages", [])

    async def delete_message(self, queue_name: str, receipt_handle: str):
        async with self._session.create_client(
            "sqs", **self._get_client_kwargs()
        ) as client:
            queue_url_resp = await client.get_queue_url(QueueName=queue_name)
            queue_url = queue_url_resp["QueueUrl"]
            await client.delete_message(
                QueueUrl=queue_url, ReceiptHandle=receipt_handle
            )

    async def get_queue_attributes(self, queue_name: str) -> dict:
        async with self._session.create_client(
            "sqs", **self._get_client_kwargs()
        ) as client:
            queue_url_resp = await client.get_queue_url(QueueName=queue_name)
            queue_url = queue_url_resp["QueueUrl"]
            resp = await client.get_queue_attributes(
                QueueUrl=queue_url,
                AttributeNames=[
                    "ApproximateNumberOfMessages",
                    "ApproximateNumberOfMessagesNotVisible",
                ],
            )
            return resp.get("Attributes", {})
