import uuid

from app.schemas import ApiModel


# api-contracts.md §6.6
class SubscriptionResponse(ApiModel):
    event_id: uuid.UUID
    subscribed: bool
