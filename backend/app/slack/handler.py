"""
P6 — Background task handler for Slack events.
Owner: BE

Ghost bot safety: try/except wraps entire task. Inner except on fallback slack_post.
If even the fallback fails, log and move on — never go silent without trying.
"""
import logging

from app.agent.loop import run_investigation
from app.slack.poster import slack_post, format_slack_result

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
        await slack_post(bot_token, channel, thread_ts, "Investigating — this takes ~30s ⏳")

        # Collect the full agent result (stream consumed internally here)
        final_event = None
        async for chunk in run_investigation(
            investigation_id="slack",
            question=question,
            connection_id=connection_id,
            workspace_id=workspace_id,
        ):
            # Parse final event from SSE stream
            if b'"verdict"' in chunk and b"event: final" in chunk:
                import json
                data_line = [l for l in chunk.decode().split("\n") if l.startswith("data:")]
                if data_line:
                    final_event = json.loads(data_line[0].removeprefix("data:").strip())

        if final_event:
            await slack_post(bot_token, channel, thread_ts, format_slack_result(final_event))
        else:
            await slack_post(bot_token, channel, thread_ts, "Investigation complete — check the dashboard for details.")

    except Exception as e:
        logger.error(f"Slack agent failure: {e}", exc_info=True)
        try:
            await slack_post(
                bot_token, channel, thread_ts,
                "I ran into an infrastructure issue querying the data. "
                "Please check the dashboard for details.",
            )
        except Exception:
            pass  # if even the fallback post fails, log and move on
