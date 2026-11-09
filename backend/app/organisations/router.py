from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.organisations.models import Organization
from app.organisations.schemas import OrganizationResponse

router = APIRouter(tags=["organizations"])


@router.get("/organizations", response_model=list[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)) -> list[Organization]:
    return list(db.scalars(select(Organization).order_by(Organization.name, Organization.id)))
