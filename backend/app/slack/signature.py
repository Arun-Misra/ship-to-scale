"""
P6 — Slack HMAC-SHA256 signature verification.
Owner: BE

RULES:
- Raw bytes first. NEVER mutate the body before calling this.
- Timestamp check is MANDATORY — prevents replay attacks.
- hmac.compare_digest is MANDATORY — prevents timing attacks.
"""
import hashlib
import hmac
import time

from fastapi import HTTPException
from app.config import settings


def verify_slack_signature(raw_body: bytes, headers: dict) -> None:
    slack_signature = headers.get("x-slack-signature", "")
    slack_timestamp = headers.get("x-slack-request-timestamp", "")

    if not slack_timestamp:
        raise HTTPException(403, "Missing Slack timestamp")

    # Replay attack prevention — reject requests older than 5 minutes
    if abs(time.time() - float(slack_timestamp)) > 300:
        raise HTTPException(403, "Request timestamp too old")

    sig_basestring = f"v0:{slack_timestamp}:{raw_body.decode('utf-8')}"
    expected = "v0=" + hmac.new(
        settings.slack_signing_secret.encode(),
        sig_basestring.encode(),
        hashlib.sha256,
    ).hexdigest()

    # Timing-safe comparison — prevents timing oracle attacks
    if not hmac.compare_digest(expected, slack_signature):
        raise HTTPException(403, "Invalid Slack signature")
