import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthContext, require_csrf, require_member
from app.db.session import get_db
from app.notifications.schemas import SubscriptionResponse
from app.notifications.service import subscribe, unsubscribe

# Members only (api-contracts.md §2): the session is checked before IDs, so 401 comes first
router = APIRouter(tags=["subscriptions"], dependencies=[Depends(require_member)])


# api-contracts.md §6.6 (US-45a)
@router.put("/events/{eventId}/subscription", response_model=SubscriptionResponse)
def subscribe_to_event(
    event_id: Annotated[uuid.UUID, Path(alias="eventId")],
    auth: AuthContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    subscribe(db, event_id, auth.user, datetime.now(UTC))
    return SubscriptionResponse(event_id=event_id, subscribed=True)


# api-contracts.md §6.7 (US-45a)
@router.delete("/events/{eventId}/subscription", status_code=204)
def unsubscribe_from_event(
    event_id: Annotated[uuid.UUID, Path(alias="eventId")],
    auth: AuthContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> Response:
    unsubscribe(db, event_id, auth.user)
    return Response(status_code=204)
