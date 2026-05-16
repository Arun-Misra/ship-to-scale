"""P6 — Post messages to Slack via Web API."""
import httpx


async def slack_post(bot_token: str, channel: str, thread_ts: str, text: str) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {bot_token}"},
            json={"channel": channel, "thread_ts": thread_ts, "text": text},
        )


def format_slack_result(result: dict) -> str:
    """Format a FinalEvent dict as a plain-text Slack message."""
    lines = []
    verdict = result.get("verdict", "inconclusive")
    root_cause = result.get("root_cause", "No conclusion reached.")
    confidence = result.get("confidence", "low")
    recommended = result.get("recommended_action", "")
    receipts = result.get("definition_receipts", [])

    lines.append(f"*{verdict.upper()}* (confidence: {confidence})")
    lines.append(f"\n{root_cause}")
    if recommended:
        lines.append(f"\n*Recommended action:* {recommended}")
    if receipts:
        lines.append("\n*Definitions used:*")
        for r in receipts[:3]:
            lines.append(f"  • {r['term']}: {r['definition']}")

    return "\n".join(lines)
