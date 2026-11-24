import uuid

from app.schemas import ApiModel


class MeOrganization(ApiModel):
    id: uuid.UUID
    name: str


# api-contracts.md §4 GET /api/auth/me
class MeResponse(ApiModel):
    id: uuid.UUID
    email: str
    organization: MeOrganization | None
    can_publish: bool
    csrf_token: str
