from fastapi import APIRouter
from pydantic import BaseModel

from schema_introspect import get_schema_context, get_schema_structured


router = APIRouter(prefix="/schema", tags=["schema"])


class SchemaRequest(BaseModel):
    database_url: str | None = None


@router.get("")
def get_schema(database_url: str | None = None):
    schema = get_schema_context(database_url=database_url)
    return {"schema": schema}


@router.get("/structured")
def get_schema_structured_endpoint(database_url: str | None = None):
    return get_schema_structured(database_url=database_url)


@router.post("")
def get_custom_schema(request: SchemaRequest):
    if request.database_url:
        return get_schema_structured(database_url=request.database_url, force_refresh=True)
    return get_schema_structured()
