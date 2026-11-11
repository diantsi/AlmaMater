from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dictionaries.models import Faculty, Topic
from app.dictionaries.schemas import DictionaryItemResponse

router = APIRouter(tags=["dictionaries"])


@router.get("/topics", response_model=list[DictionaryItemResponse])
def list_topics(db: Session = Depends(get_db)) -> list[Topic]:
    return list(db.scalars(select(Topic).order_by(Topic.name, Topic.id)))


@router.get("/faculties", response_model=list[DictionaryItemResponse])
def list_faculties(db: Session = Depends(get_db)) -> list[Faculty]:
    return list(db.scalars(select(Faculty).order_by(Faculty.name, Faculty.id)))
