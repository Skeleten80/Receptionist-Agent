from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.models import (
    Appointment,
    Business,
    BusinessHours,
    Call,
    CallOutcome,
    EscalationRule,
    KnowledgeBaseEntry,
    Lead,
    ServiceType,
)
from app.db.session import get_db
from app.dependencies import get_business_by_api_key
from app.schemas import (
    AppointmentOut,
    BusinessHoursIn,
    BusinessHoursOut,
    BusinessOut,
    BusinessUpdate,
    CallDetailOut,
    CallOut,
    EscalationRuleIn,
    EscalationRuleOut,
    KnowledgeBaseIn,
    KnowledgeBaseOut,
    LeadOut,
    NotificationSettingsIn,
    ServiceTypeIn,
    ServiceTypeOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/business", response_model=BusinessOut)
def get_business(business: Annotated[Business, Depends(get_business_by_api_key)]) -> Business:
    return business


@router.patch("/business", response_model=BusinessOut)
def update_business(
    payload: BusinessUpdate,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> Business:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(business, field, value)
    db.commit()
    db.refresh(business)
    return business


@router.get("/business/hours", response_model=list[BusinessHoursOut])
def list_hours(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[BusinessHours]:
    return (
        db.query(BusinessHours)
        .filter(BusinessHours.business_id == business.id)
        .order_by(BusinessHours.day_of_week)
        .all()
    )


@router.put("/business/hours", response_model=list[BusinessHoursOut])
def replace_hours(
    payload: list[BusinessHoursIn],
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[BusinessHours]:
    db.query(BusinessHours).filter(BusinessHours.business_id == business.id).delete()
    rows = [
        BusinessHours(business_id=business.id, **item.model_dump()) for item in payload
    ]
    db.add_all(rows)
    db.commit()
    return (
        db.query(BusinessHours)
        .filter(BusinessHours.business_id == business.id)
        .order_by(BusinessHours.day_of_week)
        .all()
    )


@router.get("/service-types", response_model=list[ServiceTypeOut])
def list_services(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ServiceType]:
    return db.query(ServiceType).filter(ServiceType.business_id == business.id).all()


@router.post("/service-types", response_model=ServiceTypeOut, status_code=201)
def create_service(
    payload: ServiceTypeIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> ServiceType:
    row = ServiceType(business_id=business.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/service-types/{service_id}", response_model=ServiceTypeOut)
def update_service(
    service_id: UUID,
    payload: ServiceTypeIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> ServiceType:
    row = (
        db.query(ServiceType)
        .filter(ServiceType.id == service_id, ServiceType.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Service type not found")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/service-types/{service_id}", status_code=204)
def delete_service(
    service_id: UUID,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    row = (
        db.query(ServiceType)
        .filter(ServiceType.id == service_id, ServiceType.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Service type not found")
    db.delete(row)
    db.commit()


@router.get("/knowledge-base", response_model=list[KnowledgeBaseOut])
def list_kb(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[KnowledgeBaseEntry]:
    return db.query(KnowledgeBaseEntry).filter(KnowledgeBaseEntry.business_id == business.id).all()


@router.post("/knowledge-base", response_model=KnowledgeBaseOut, status_code=201)
def create_kb(
    payload: KnowledgeBaseIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> KnowledgeBaseEntry:
    row = KnowledgeBaseEntry(business_id=business.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/knowledge-base/{entry_id}", response_model=KnowledgeBaseOut)
def update_kb(
    entry_id: UUID,
    payload: KnowledgeBaseIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> KnowledgeBaseEntry:
    row = (
        db.query(KnowledgeBaseEntry)
        .filter(KnowledgeBaseEntry.id == entry_id, KnowledgeBaseEntry.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="KB entry not found")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/knowledge-base/{entry_id}", status_code=204)
def delete_kb(
    entry_id: UUID,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    row = (
        db.query(KnowledgeBaseEntry)
        .filter(KnowledgeBaseEntry.id == entry_id, KnowledgeBaseEntry.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="KB entry not found")
    db.delete(row)
    db.commit()


@router.get("/escalation-rules", response_model=list[EscalationRuleOut])
def list_rules(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[EscalationRule]:
    return db.query(EscalationRule).filter(EscalationRule.business_id == business.id).all()


@router.post("/escalation-rules", response_model=EscalationRuleOut, status_code=201)
def create_rule(
    payload: EscalationRuleIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> EscalationRule:
    row = EscalationRule(business_id=business.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/escalation-rules/{rule_id}", response_model=EscalationRuleOut)
def update_rule(
    rule_id: UUID,
    payload: EscalationRuleIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> EscalationRule:
    row = (
        db.query(EscalationRule)
        .filter(EscalationRule.id == rule_id, EscalationRule.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in payload.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/escalation-rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: UUID,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    row = (
        db.query(EscalationRule)
        .filter(EscalationRule.id == rule_id, EscalationRule.business_id == business.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(row)
    db.commit()


@router.get("/notification-settings", response_model=NotificationSettingsIn)
def get_notification_settings(
    business: Annotated[Business, Depends(get_business_by_api_key)],
) -> dict:
    return {
        "owner_email": business.owner_email,
        "owner_phone": business.owner_phone,
        "notification_email_enabled": business.notification_email_enabled,
        "notification_sms_enabled": business.notification_sms_enabled,
    }


@router.put("/notification-settings", response_model=NotificationSettingsIn)
def update_notification_settings(
    payload: NotificationSettingsIn,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    business.owner_email = str(payload.owner_email)
    business.owner_phone = payload.owner_phone
    business.notification_email_enabled = payload.notification_email_enabled
    business.notification_sms_enabled = payload.notification_sms_enabled
    db.commit()
    return payload.model_dump()


@router.get("/calls", response_model=list[CallOut])
def list_calls(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
    status_filter: Optional[str] = Query(None, alias="status"),
    outcome: Optional[str] = None,
) -> list[Call]:
    q = db.query(Call).filter(Call.business_id == business.id)
    if status_filter:
        q = q.filter(Call.status == status_filter)
    if outcome:
        q = q.filter(Call.outcome == outcome)
    return q.order_by(Call.started_at.desc()).limit(200).all()


@router.get("/calls/{call_id}", response_model=CallDetailOut)
def get_call(
    call_id: UUID,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> CallDetailOut:
    call = (
        db.query(Call)
        .filter(Call.id == call_id, Call.business_id == business.id)
        .one_or_none()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    turns = call.transcript.turns if call.transcript else []
    return CallDetailOut(
        **CallOut.model_validate(call).model_dump(),
        transcript_turns=turns or [],
        agent_messages=call.agent_messages or [],
    )


@router.get("/leads", response_model=list[LeadOut])
def list_leads(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Lead]:
    return (
        db.query(Lead)
        .filter(Lead.business_id == business.id)
        .order_by(Lead.created_at.desc())
        .limit(200)
        .all()
    )


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Appointment]:
    return (
        db.query(Appointment)
        .filter(Appointment.business_id == business.id)
        .order_by(Appointment.created_at.desc())
        .limit(200)
        .all()
    )


@router.get("/escalations", response_model=list[CallOut])
def list_escalations(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Call]:
    return (
        db.query(Call)
        .filter(Call.business_id == business.id, Call.outcome == CallOutcome.ESCALATED.value)
        .order_by(Call.started_at.desc())
        .limit(200)
        .all()
    )


@router.get("/failed-calls", response_model=list[CallOut])
def list_failed(
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Call]:
    return (
        db.query(Call)
        .filter(Call.business_id == business.id, Call.status == "failed")
        .order_by(Call.started_at.desc())
        .limit(200)
        .all()
    )
