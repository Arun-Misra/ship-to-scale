"""P6 gate: Slack signature verification."""
import hashlib
import hmac
import time
import pytest
from fastapi import HTTPException
from unittest.mock import patch

from app.slack.signature import verify_slack_signature


def _make_signature(body: bytes, timestamp: str, secret: str = "test_secret") -> str:
    sig_basestring = f"v0:{timestamp}:{body.decode('utf-8')}"
    return "v0=" + hmac.new(secret.encode(), sig_basestring.encode(), hashlib.sha256).hexdigest()


def test_valid_signature_passes():
    body = b'{"type": "event_callback"}'
    ts = str(int(time.time()))
    sig = _make_signature(body, ts)
    with patch("app.slack.signature.settings") as mock_settings:
        mock_settings.slack_signing_secret = "test_secret"
        verify_slack_signature(body, {"x-slack-signature": sig, "x-slack-request-timestamp": ts})


def test_old_timestamp_rejected():
    body = b'{"type": "event_callback"}'
    old_ts = str(int(time.time()) - 400)  # 400s ago — over the 300s limit
    sig = _make_signature(body, old_ts)
    with patch("app.slack.signature.settings") as mock_settings:
        mock_settings.slack_signing_secret = "test_secret"
        with pytest.raises(HTTPException) as exc_info:
            verify_slack_signature(body, {"x-slack-signature": sig, "x-slack-request-timestamp": old_ts})
        assert exc_info.value.status_code == 403


def test_wrong_signature_rejected():
    body = b'{"type": "event_callback"}'
    ts = str(int(time.time()))
    with patch("app.slack.signature.settings") as mock_settings:
        mock_settings.slack_signing_secret = "test_secret"
        with pytest.raises(HTTPException):
            verify_slack_signature(body, {"x-slack-signature": "v0=wrongsig", "x-slack-request-timestamp": ts})
