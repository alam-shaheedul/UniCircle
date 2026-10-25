"""Add feature routers here in Phase 7 under the stable /api/v1 prefix."""

from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.assistant.router import router as assistant_router
from app.modules.auth.router import profile_router
from app.modules.auth.router import router as auth_router
from app.modules.campus.router import router as campus_router
from app.modules.clubs.router import router as clubs_router
from app.modules.directory.router import router as directory_router
from app.modules.forum.router import router as forum_router
from app.modules.news.router import router as news_router
from app.modules.notifications.router import router as notifications_router
from app.modules.resources.router import router as resources_router
from app.modules.transport.router import router as transport_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(admin_router)
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(directory_router)
api_router.include_router(campus_router)
api_router.include_router(clubs_router)
api_router.include_router(resources_router)
api_router.include_router(transport_router)
api_router.include_router(forum_router)
api_router.include_router(news_router)
api_router.include_router(notifications_router)
api_router.include_router(assistant_router)
