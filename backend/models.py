from pydantic import BaseModel

from app.schemas import QueryRequest, QueryResponse


class QueryError(BaseModel):
    error: str
