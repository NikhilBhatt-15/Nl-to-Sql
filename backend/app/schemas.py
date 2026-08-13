from pydantic import BaseModel, EmailStr, Field


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    database_url: str | None = None


class QueryResponse(BaseModel):
    database: str
    sql: str
    columns: list[str]
    rows: list[dict]
    summary: str
    credits_remaining: int


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    credits_remaining: int
    email: str


class CurrentUserResponse(BaseModel):
    user_id: int
    email: str
    credits_remaining: int
