from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""

    appwrite_endpoint: str = "https://cloud.appwrite.io/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""
    appwrite_db_id: str = ""
    appwrite_collection_workspaces: str = "workspaces"
    appwrite_collection_connections: str = "connections"
    appwrite_collection_semantic: str = "semantic_definitions"
    appwrite_collection_investigations: str = "investigations"
    appwrite_collection_slack_installations: str = "slack_installations"

    slack_bot_token: str = ""
    slack_signing_secret: str = ""
    slack_client_id: str = ""
    slack_client_secret: str = ""

    demo_db_path: str = "data/demo.duckdb"
    frontend_url: str = "http://localhost:5173"

    sandbox_statement_timeout_seconds: int = 8
    sandbox_row_cap: int = 5000
    agent_step_budget: int = 8
    agent_retry_budget_per_step: int = 2


settings = Settings()
