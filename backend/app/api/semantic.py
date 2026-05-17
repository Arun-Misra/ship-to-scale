"""
Semantic store — read and write the workspace's captured metric definitions.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.appwrite.auth import require_auth
from app.appwrite.store import (
    list_semantic_definitions,
    save_semantic_definition,
    delete_semantic_definition,
)

router = APIRouter()


class CreateSemanticDefRequest(BaseModel):
    term: str
    natural_language: str
    definition_sql: str
    source: str = "manual"
    materiality: str = "material"


@router.get("/semantic")
async def get_semantic(user=Depends(require_auth)):
    definitions = await list_semantic_definitions(workspace_id=user["workspace_id"])
    return {"definitions": definitions}


@router.post("/semantic")
async def create_semantic_def(body: CreateSemanticDefRequest, user=Depends(require_auth)):
    await save_semantic_definition(
        workspace_id=user["workspace_id"],
        term=body.term,
        natural_language=body.natural_language,
        definition_sql=body.definition_sql,
        source=body.source,
        materiality=body.materiality,
    )
    return {"status": "created"}


@router.delete("/semantic/{def_id}")
async def delete_semantic_def(def_id: str, user=Depends(require_auth)):
    deleted = await delete_semantic_definition(def_id, workspace_id=user["workspace_id"])
    if not deleted:
        raise HTTPException(404, "Definition not found or not owned by this workspace")
    return {"status": "deleted"}
