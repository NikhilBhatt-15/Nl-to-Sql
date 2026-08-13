from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth_store import initialize_auth_store
from app.config import settings
from app.routes.auth import router as auth_router
from app.routes.query import router as query_router
from app.routes.schema import router as schema_router


load_dotenv()
initialize_auth_store()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(schema_router)
app.include_router(query_router)
