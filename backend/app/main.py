import time
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.admin import router as admin_router
from app.api.v1.chat import router as chat_router
from app.api.v1.demo import router as demo_router
from app.api.v1.documents import router as documents_router
from app.api.v1.health import router as health_router
from app.api.v1.me import router as me_router
from app.api.v1.workspaces import router as workspaces_router
from app.core.config import settings
from app.core.errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.limits import limiter
from app.core.logging import get_logger, request_id_ctx_var, setup_logging
from app.services.ingestion.worker import worker
from app.services.providers.gemini import verify_embedding_dimension

logger = get_logger("app.main")


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "rate_limit_exceeded",
                "message": "Too many requests. Please slow down.",
            }
        },
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        f"Starting application in {settings.APP_ENV} mode",
        extra={"env": settings.APP_ENV},
    )

    # Startup self-check: verify embedding length equals EMBED_DIM
    if settings.GEMINI_API_KEY and settings.APP_ENV != "test":
        try:
            await verify_embedding_dimension(worker._provider)
        except Exception as e:
            logger.error(f"Startup embedding verification failed: {e}")
            raise

    # Start background ingestion worker (in non-test modes)
    if settings.APP_ENV != "test":
        worker.start()

    yield

    logger.info("Shutting down application")
    if settings.APP_ENV != "test":
        await worker.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Company Knowledge Assistant API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter

    # Body size limit middleware (S26: reject requests > 11 MB)
    @app.middleware("http")
    async def body_size_limit_middleware(request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length_int = int(content_length)
                max_bytes = 11 * 1024 * 1024  # 11 MB
                if length_int > max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": "payload_too_large",
                                "message": f"Request body exceeds maximum allowed size ({max_bytes // (1024 * 1024)} MB)",
                            }
                        },
                    )
            except ValueError:
                pass
        return await call_next(request)

    # Security headers middleware (S25)
    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        return response

    # Request ID and timing middleware
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next) -> Response:
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_ctx_var.set(req_id)
        start_time = time.perf_counter()

        response = await call_next(request)

        process_time = time.perf_counter() - start_time
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response

    # CORS configuration (S24: never allow "*" when allow_credentials=True)
    raw_origins = (
        settings.CORS_ORIGINS
        if isinstance(settings.CORS_ORIGINS, list)
        else [settings.CORS_ORIGINS]
    )
    safe_origins = [o for o in raw_origins if o and o != "*"]
    if not safe_origins:
        safe_origins = ["http://localhost:5173"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=safe_origins,
        allow_origin_regex=r"^https://.*\.pages\.dev$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # API Routers
    app.include_router(health_router)
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(demo_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(workspaces_router, prefix="/api/v1")
    app.include_router(documents_router, prefix="/api/v1")
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(me_router, prefix="/api/v1")

    return app


app = create_app()
