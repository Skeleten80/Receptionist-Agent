from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Business
from app.db.session import get_db
from app.dependencies import get_business_by_api_key
from app.services.retention import delete_call_data

router = APIRouter(prefix="/admin", tags=["privacy"])


@router.delete("/calls/{call_id}/data")
def delete_call_personal_data(
    call_id: UUID,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    ok = delete_call_data(db, business_id=business.id, call_id=call_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"deleted": True, "call_id": str(call_id)}
