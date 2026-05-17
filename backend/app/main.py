from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api import health, connections, investigations, signals, reports, semantic, dashboard, slack, chat

app = FastAPI(title="viriya API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(investigations.router, prefix="/api/v1")
app.include_router(signals.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(semantic.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(slack.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
