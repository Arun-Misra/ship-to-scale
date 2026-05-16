"""
P3 — Appwrite SDK client init.
Owner: BE

The Appwrite Python SDK is SYNCHRONOUS (uses requests under the hood).
NEVER call SDK methods directly in async context.
ALWAYS wrap in anyio.to_thread.run_sync() — see store.py.
"""
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.users import Users

from app.config import settings

_client = Client()
_client.set_endpoint(settings.appwrite_endpoint)
_client.set_project(settings.appwrite_project_id)
_client.set_key(settings.appwrite_api_key)

db = Databases(_client)
users = Users(_client)
