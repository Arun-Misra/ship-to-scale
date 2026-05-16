"""
P6 [STUB] — Weekly board report generator + Slack dispatch.
Owner: BE
TODO P6: generate from demo dataset queries + post to configured Slack channel.
"""
import logging
from app.slack.poster import slack_post

logger = logging.getLogger(__name__)


async def dispatch_weekly_report(workspace_id: str) -> None:
    # TODO P6:
    # 1. Run canned queries against demo dataset (revenue week-over-week, top metrics)
    # 2. Format as Slack message
    # 3. Post to the workspace's configured report channel
    logger.info(f"Weekly report dispatch requested for workspace {workspace_id}")
    # Pre-generated report stub for demo
    report_text = (
        "*📊 Weekly Business Report — DataPilot*\n\n"
        "• Revenue this week: $184,320 (+12% vs last week)\n"
        "• Active customers: 1,247 (+3%)\n"
        "• Churn rate: 2.1% (stable)\n"
        "• Top region: North America ($98,400)\n\n"
        "_Generated automatically by DataPilot. No analyst required._"
    )
    # TODO: get bot_token + report_channel from workspace settings
    logger.info("Report generated (stub): " + report_text)
