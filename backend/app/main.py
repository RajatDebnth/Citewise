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
    yield
    logger.info("Shutting down application")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Company Knowledge Assistant API",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter

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

    # CORS configuration
    origins = (
        settings.CORS_ORIGINS
        if isinstance(settings.CORS_ORIGINS, list)
        else [settings.CORS_ORIGINS]
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
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
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(workspaces_router, prefix="/api/v1")
    app.include_router(documents_router, prefix="/api/v1")
    app.include_router(me_router, prefix="/api/v1")

    return app


app = create_app()
