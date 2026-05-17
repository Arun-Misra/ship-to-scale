"""
Shared in-memory process state.
Replace _investigations with Appwrite persistence in P3.
"""

# Keyed by investigation_id. Each value is the dict saved at POST /investigations.
investigations: dict[str, dict] = {}

# Keyed by conversation_id. Each value holds workspace_id, connection_id, and messages list.
conversations: dict[str, dict] = {}
