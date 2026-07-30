from fastapi import APIRouter, HTTPException, Depends
from app import database, auth
from app.schemas import RuleIn

router = APIRouter()

@router.get("/api/rules")
def list_rules(user: dict = Depends(auth.get_current_user)):
    return database.get_rules(user["id"])

@router.post("/api/rules")
def create_rule(data: RuleIn, user: dict = Depends(auth.get_current_user)):
    if data.type not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="Type must be 'percentage' or 'fixed'.")
    if data.value <= 0:
        raise HTTPException(status_code=400, detail="Value must be positive.")
    rid = database.create_rule(user["id"], data.label, data.envelope_id, data.type, data.value, data.priority)
    if rid is None:
        raise HTTPException(status_code=400, detail="Envelope not found.")
    return {"id": rid, "message": "Rule created."}

@router.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: int, user: dict = Depends(auth.get_current_user)):
    database.delete_rule(user["id"], rule_id)
    return {"message": "Rule deleted."}

@router.post("/api/rules/{rule_id}/apply_retroactive")
def apply_retroactive(rule_id: int, user: dict = Depends(auth.get_current_user)):
    uid = user["id"]
    rules = database.get_rules(uid)
    rule = next((r for r in rules if r["id"] == rule_id), None)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found.")
        
    envelopes = database.get_envelopes(uid)
    general = next((e for e in envelopes if e["name"] == "General"), None)
    if not general or general["balance"] <= 0:
        raise HTTPException(status_code=400, detail="No funds in General envelope.")
        
    amount = 0
    if rule["type"] == "percentage":
        amount = round(general["balance"] * (rule["value"] / 100), 2)
    else:
        amount = rule["value"]
        
    amount = min(amount, general["balance"])
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Calculated amount is zero.")
        
    success, msg = database.transfer_between_envelopes(
        uid, general["id"], rule["envelope_id"], amount, "Retroactive Rule Application"
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=msg)
        
    return {"message": f"Successfully transferred {amount} RWF from General to {rule['envelope_name']}."}
