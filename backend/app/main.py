"""UniCircle ASGI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.schemas import ApiResponse, HealthStatus
from app.core.config import Settings, get_settings
from app.core.errors import install_exception_handlers
from app.core.logging import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    supplied_settings = settings
    settings = settings or get_settings()
    configure_logging(settings)
    application = FastAPI(
        title="UniCircle API",
        version="0.1.0",
        openapi_url="/api/v1/openapi.json",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )
    if supplied_settings is not None:
        application.dependency_overrides[get_settings] = lambda: settings
    install_exception_handlers(application)

    @application.get("/health", response_model=ApiResponse[HealthStatus])
    def health() -> ApiResponse[HealthStatus]:
        """Liveness only; database readiness is checked separately."""
        return ApiResponse(data=HealthStatus())

    application.include_router(api_router)
    return application


app = create_app()
