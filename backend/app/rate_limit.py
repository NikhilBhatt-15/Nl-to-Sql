from datetime import datetime, timezone

from fastapi import HTTPException
from redis import Redis
from redis.exceptions import RedisError

from app.config import settings


_redis_client: Redis | None = None


def _get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def _increment_with_window(redis_client: Redis, key: str, window_seconds: int) -> tuple[int, int]:
    pipeline = redis_client.pipeline()
    pipeline.incr(key)
    pipeline.ttl(key)
    current, ttl = pipeline.execute()

    if int(current) == 1 or int(ttl) == -1:
        redis_client.expire(key, window_seconds)
        ttl = window_seconds

    return int(current), max(int(ttl), 0)


def _client_ip_from_request(request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce_query_limits(user_id: int, request) -> None:
    if settings.rate_limit_per_minute_user <= 0 and settings.rate_limit_per_minute_ip <= 0 and settings.daily_query_limit_per_user <= 0:
        return

    now = datetime.now(timezone.utc)
    minute_key_suffix = now.strftime("%Y%m%d%H%M")
    day_key_suffix = now.strftime("%Y%m%d")
    ip = _client_ip_from_request(request)

    user_minute_key = f"rl:user:{user_id}:{minute_key_suffix}"
    ip_minute_key = f"rl:ip:{ip}:{minute_key_suffix}"
    daily_user_key = f"daily:user:{user_id}:{day_key_suffix}"

    try:
        redis_client = _get_redis()

        if settings.rate_limit_per_minute_user > 0:
            user_count, user_ttl = _increment_with_window(redis_client, user_minute_key, 60)
            if user_count > settings.rate_limit_per_minute_user:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: max {settings.rate_limit_per_minute_user} queries per minute per user.",
                    headers={"Retry-After": str(user_ttl or 60)},
                )

        if settings.rate_limit_per_minute_ip > 0:
            ip_count, ip_ttl = _increment_with_window(redis_client, ip_minute_key, 60)
            if ip_count > settings.rate_limit_per_minute_ip:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: max {settings.rate_limit_per_minute_ip} queries per minute per IP.",
                    headers={"Retry-After": str(ip_ttl or 60)},
                )

        if settings.daily_query_limit_per_user > 0:
            daily_count, daily_ttl = _increment_with_window(redis_client, daily_user_key, 86400)
            if daily_count > settings.daily_query_limit_per_user:
                raise HTTPException(
                    status_code=429,
                    detail=f"Daily limit reached: max {settings.daily_query_limit_per_user} queries per user per day.",
                    headers={"Retry-After": str(daily_ttl or 86400)},
                )

    except RedisError as exc:
        if settings.redis_strict_mode:
            raise HTTPException(
                status_code=503,
                detail=f"Rate limiting service unavailable: {exc}",
            )
