"""P6 — Slack OAuth install flow. Nonce store + code exchange."""
import httpx
from app.config import settings

# Server-side nonce store (in-memory for hackathon; use Appwrite/Redis in production)
pending_installs: dict[str, dict] = {}


async def exchange_slack_code(code: str) -> tuple[str, str, str]:
    """Exchange OAuth code for bot_token. Returns (team_id, bot_token, team_name)."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "code": code,
                "client_id": settings.slack_client_id,
                "client_secret": settings.slack_client_secret,
            },
        )
        data = resp.json()
        if not data.get("ok"):
            raise Exception(f"Slack OAuth error: {data.get('error')}")
        return (
            data["team"]["id"],
            data["access_token"],
            data["team"]["name"],
        )
