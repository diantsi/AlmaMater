import uuid

from app.schemas import ApiModel


class OrganizationResponse(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
