import uuid

from app.schemas import ApiModel


class DictionaryItemResponse(ApiModel):
    id: uuid.UUID
    code: str
    name: str
