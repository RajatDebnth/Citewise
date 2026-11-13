from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_ctx_var

logger = get_logger("app.errors")


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AppException(Exception):
    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "internal_error",
        message: str = "An internal server error occurred",
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "not_found"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code=code,
            message=message,
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Unauthorized", code: str = "unauthorized"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=code,
            message=message,
        )


class ForbiddenException(AppException):
    def __init__(self, message: str = "Forbidden", code: str = "forbidden"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code=code,
            message=message,
        )


class BadRequestException(AppException):
    def __init__(self, message: str = "Bad request", code: str = "bad_request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=code,
            message=message,
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    req_id = request_id_ctx_var.get("")
    logger.warning(
        f"AppException: code={exc.code} status={exc.status_code} message={exc.message} request_id={req_id}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    req_id = request_id_ctx_var.get("")
    code = "http_error"
    if exc.status_code == 404:
        code = "not_found"
    elif exc.status_code == 401:
        code = "unauthorized"
    elif exc.status_code == 403:
        code = "forbidden"
    elif exc.status_code == 400:
        code = "bad_request"
    elif exc.status_code == 429:
        code = "rate_limit_exceeded"

    msg = str(exc.detail) if exc.detail else "An error occurred"
    logger.warning(
        f"HTTPException: status={exc.status_code} code={code} message={msg} request_id={req_id}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": msg}},
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    req_id = request_id_ctx_var.get("")
    logger.warning(f"Validation error: {exc.errors()} request_id={req_id}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "validation_error",
                "message": "Invalid request parameters or payload",
            }
        },
    )


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    req_id = request_id_ctx_var.get("")
    logger.error(
        f"Unhandled server error: {exc} request_id={req_id}", exc_info=exc
    )
    # S27. Error responses never include stack traces or SQL.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred. Please try again later.",
            }
        },
    )

