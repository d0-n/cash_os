from fastapi import APIRouter, HTTPException, Depends
from app import database, auth
from app.schemas import EnvelopeIn

router = APIRouter()

@router.get("/api/envelopes")
def list_envelopes(user: dict = Depends(auth.get_current_user)):
    return database.get_envelopes(user["id"])

@router.post("/api/envelopes")
def create_envelope(data: EnvelopeIn, user: dict = Depends(auth.get_current_user)):
    eid = database.create_envelope(user["id"], data.name, data.goal, data.goal_date, data.color)
    if eid is None:
        raise HTTPException(status_code=400, detail=f"Envelope '{data.name}' already exists.")
    return {"id": eid, "message": f"Envelope '{data.name}' created."}

@router.delete("/api/envelopes/{envelope_id}")
def delete_envelope(envelope_id: int, user: dict = Depends(auth.get_current_user)):
    ok = database.delete_envelope(user["id"], envelope_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete this envelope.")
    return {"message": "Envelope deleted."}
