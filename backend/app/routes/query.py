from fastapi import APIRouter, Depends, HTTPException, Request

import database
from app import auth_store
from app.config import settings
from app.dependencies import get_current_user
from app.rate_limit import enforce_query_limits
from app.schemas import QueryRequest, QueryResponse
from sql_generator import explain_results, generate_sql
from sql_validator import validate


router = APIRouter(tags=["query"])


@router.post("/query", response_model=QueryResponse)
def query(payload: QueryRequest, request: Request, current_user=Depends(get_current_user)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(question) > settings.max_question_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Question is too long. Max {settings.max_question_chars} characters.",
        )
    if len(question.split()) > settings.max_question_words:
        raise HTTPException(
            status_code=400,
            detail=f"Question is too long. Max {settings.max_question_words} words.",
        )

    enforce_query_limits(current_user.id, request)

    database_url = payload.database_url or database.get_db_manager().default_database_url
    credits_reserved = False

    try:
        credits_remaining = auth_store.consume_credits(current_user.id, settings.credits_per_query)
        credits_reserved = True
    except ValueError as exc:
        if str(exc) == "Insufficient credits.":
            raise HTTPException(
                status_code=402,
                detail="Not enough credits for this query. Please top up credits.",
            )
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        raw_sql = generate_sql(question, database_url=database_url)
        if raw_sql.strip() == "NO_QUERY_POSSIBLE":
            raise HTTPException(
                status_code=400,
                detail="That question cannot be answered from this database schema.",
            )

        result = validate(raw_sql, max_rows=settings.max_rows_returned, database_url=database_url)
        if not result.is_valid:
            raise HTTPException(status_code=400, detail=result.error)

        rows = database.run_raw_query(
            result.sql,
            database_url=database_url,
            timeout_seconds=settings.query_timeout_seconds,
        )
    except HTTPException:
        if credits_reserved:
            auth_store.add_credits(current_user.id, settings.credits_per_query)
        raise
    except Exception as exc:
        if credits_reserved:
            auth_store.add_credits(current_user.id, settings.credits_per_query)
        raise HTTPException(status_code=500, detail=f"Query execution failed: {exc}")

    columns = list(rows[0].keys()) if rows else []
    summary = explain_results(question, rows, database_url=database_url)
    if len(summary) > settings.max_summary_chars:
        summary = summary[: settings.max_summary_chars].rstrip() + "..."

    return QueryResponse(
        database=database_url,
        sql=result.sql,
        columns=columns,
        rows=rows,
        summary=summary,
        credits_remaining=credits_remaining,
    )
