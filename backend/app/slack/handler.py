"""
P6 — Background task handler for Slack events.

Ghost bot safety: try/except wraps entire task. Inner except on fallback slack_post.
If even the fallback fails, log and move on — never go silent without trying.
"""

import json
import logging
import uuid

from app.agent.loop import run_investigation
from app.slack.poster import slack_post

logger = logging.getLogger(__name__)


async def handle_slack_event(
    question: str,
    channel: str,
    thread_ts: str,
    workspace_id: str,
    connection_id: str,
    bot_token: str,
) -> None:
    try:
        if not bot_token or not channel:
            logger.error("Slack handler missing bot token or channel")
            return

        if not workspace_id or not connection_id:
            await slack_post(
                bot_token,
                channel,
                thread_ts,
                "No data source is connected to this workspace yet, so I cannot run the query.",
            )
            return

        logger.info("Slack handler starting: workspace=%s connection=%s question=%s", workspace_id, connection_id, (question or '')[:120])
        investigation_id = str(uuid.uuid4())
        final_event: dict | None = None
        chat_text: str | None = None

        async for chunk in run_investigation(
            investigation_id=investigation_id,
            question=question,
            connection_id=connection_id,
            workspace_id=workspace_id,
        ):
            chunk_str = chunk.decode("utf-8", errors="ignore")

            # Capture the final investigation result
            if "event: final\n" in chunk_str:
                data_line = next(
                    (l for l in chunk_str.split("\n") if l.startswith("data:")), None
                )
                if data_line:
                    try:
                        final_event = json.loads(data_line.removeprefix("data:").strip())
                    except Exception:
                        pass

            # Capture the human-readable chat summary (always prefer this for Slack)
            elif "event: chat_response\n" in chunk_str:
                data_line = next(
                    (l for l in chunk_str.split("\n") if l.startswith("data:")), None
                )
                if data_line:
                    try:
                        data = json.loads(data_line.removeprefix("data:").strip())
                        chat_text = data.get("text", "")
                    except Exception:
                        pass

        logger.info("Slack investigation completed: chat_text_present=%s final_present=%s", bool(chat_text), bool(final_event))
        reply = _compose_reply(chat_text, final_event)
        await slack_post(bot_token, channel, thread_ts, reply)

    except Exception as e:
        logger.error("Slack agent failure: %s", e, exc_info=True)
        try:
            await slack_post(
                bot_token,
                channel,
                thread_ts,
                "I could not generate details for this query due to an internal processing error.",
            )
        except Exception:
            pass


def _compose_reply(chat_text: str | None, final_event: dict | None) -> str:
    """
    Build the Slack reply from available data.
    chat_text (from chat_response event) is the conversational summary — prefer it.
    final_event (from final event) has structured verdict/confidence/recommended.
    """
    if not chat_text and not final_event:
        return "I could not extract conclusive details for this query."

    lines: list[str] = []

    if chat_text:
        lines.append(chat_text)
    elif final_event:
        root_cause = final_event.get("root_cause", "")
        if root_cause:
            lines.append(root_cause)

    if final_event:
        verdict = final_event.get("verdict", "inconclusive").upper()
        confidence = final_event.get("confidence", "low")
        recommended = final_event.get("recommended_action", "")
        receipts = final_event.get("definition_receipts", [])

        lines.append(f"\n*Verdict:* {verdict}  ·  *Confidence:* {confidence}")
        if recommended:
            lines.append(f"*Recommended:* {recommended}")
        if receipts:
            terms = ", ".join(r["term"] for r in receipts[:3])
            lines.append(f"_Definitions used: {terms}_")

    return "\n".join(lines)
