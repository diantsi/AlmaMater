import logging
import secrets
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("almamater.api")


class ErrorDetail(BaseModel):
    field: str
    message: str


class ApiError(Exception):
    """Raised by handlers; rendered as the unified error envelope (api-contracts.md §7)."""

    def __init__(self, status_code: int, code: str, message: str, details: list[ErrorDetail] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


def _envelope(status_code: int, code: str, message: str, details: list[ErrorDetail]) -> JSONResponse:
    request_id = f"req-{secrets.token_hex(6)}"
    logger.info("api error %s %s requestId=%s", status_code, code, request_id)
    timestamp = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "details": [detail.model_dump() for detail in details],
            "requestId": request_id,
            "timestamp": timestamp,
        },
    )


def _field_path(loc: tuple) -> str:
    # Drop the location prefix ("query", "path", "body"); keep the JSON field path
    parts = [str(part) for part in loc[1:]] if loc and loc[0] in ("query", "path", "body") else [str(p) for p in loc]
    return ".".join(parts)


async def _api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return _envelope(exc.status_code, exc.code, exc.message, exc.details)


async def _request_validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [ErrorDetail(field=_field_path(tuple(err["loc"])), message=err["msg"]) for err in exc.errors()]
    return _envelope(400, "MALFORMED_REQUEST", "Request is malformed.", details)


async def _unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error", exc_info=exc)
    return _envelope(500, "INTERNAL_ERROR", "Unexpected server error.", [])


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(RequestValidationError, _request_validation_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
