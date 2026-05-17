"""
Run this instead of uvicorn directly during development.
Starts a ngrok tunnel and prints the Slack webhook URL to paste into your Slack app.

Usage:
    python start_dev.py

Optional: set NGROK_AUTHTOKEN in .env for a stable subdomain.
"""
import os
import sys
import time
import subprocess
from dotenv import load_dotenv

load_dotenv()

try:
    from pyngrok import ngrok, conf
    from pyngrok.exception import PyngrokNgrokHTTPError
except ImportError:
    print("pyngrok not installed. Run: pip install pyngrok")
    sys.exit(1)

PORT = 8000

auth_token = os.getenv("NGROK_AUTHTOKEN", "")
if auth_token:
    conf.get_default().auth_token = auth_token

# Clean up any pyngrok-managed agent from a previous run
try:
    ngrok.kill()
except Exception:
    pass

print("Starting ngrok tunnel...")
public_url = None
for attempt in range(1, 13):  # ~6 min of retries while a stale cloud session expires
    try:
        tunnel = ngrok.connect(PORT, "http")
        public_url = tunnel.public_url
        break
    except PyngrokNgrokHTTPError as e:
        if "already online" in str(e) or "ERR_NGROK_334" in str(e):
            print(f"  [{attempt}/12] Old ngrok session still online on ngrok's cloud; "
                  f"waiting 30s for it to expire...")
            try:
                ngrok.kill()
            except Exception:
                pass
            time.sleep(30)
            continue
        raise

if not public_url:
    print()
    print("ngrok endpoint is still occupied by an old session.")
    print("Open https://dashboard.ngrok.com/agents and click 'Stop' on the live")
    print("agent, then re-run:  python start_dev.py")
    sys.exit(1)

print()
print("=" * 60)
print(f"  ngrok public URL : {public_url}")
print(f"  Slack Events URL : {public_url}/api/v1/slack/events")
print()
print("  Paste the Slack Events URL into:")
print("  Slack App → Event Subscriptions → Request URL")
print("=" * 60)
print()

os.environ["NGROK_PUBLIC_URL"] = public_url

subprocess.run([
    sys.executable, "-m", "uvicorn", "app.main:app",
    "--host", "0.0.0.0",
    "--port", str(PORT),
    "--reload",
    "--log-level", "info",
])

ngrok.kill()
