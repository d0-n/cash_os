from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app import database, auth
from app.schemas import DepositIn, WithdrawIn

router = APIRouter()

@router.post("/api/deposit")
def deposit(data: DepositIn, user: dict = Depends(auth.get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    uid = user["id"]
    tid = database.create_transaction(uid, data.amount, data.label, data.note)

    all_rules = database.get_rules(uid)
    matching = [r for r in all_rules if r["active"] and r["label"] in (data.label, "any")]
    matching.sort(key=lambda r: r["priority"])

    remaining = data.amount
    allocations = []

    for rule in matching:
        if remaining <= 0:
            break

        chunk = round(data.amount * (rule["value"] / 100), 2) if rule["type"] == "percentage" else rule["value"]
        chunk = min(chunk, remaining)

        if chunk > 0:
            database.create_allocation(tid, rule["envelope_id"], chunk)
            remaining = round(remaining - chunk, 2)
            allocations.append({"envelope": rule["envelope_name"], "amount": chunk})

    if remaining > 0:
        envelopes = database.get_envelopes(uid)
        general = next((e for e in envelopes if e["name"] == "General"), None)
        if general:
            database.create_allocation(tid, general["id"], remaining)
            allocations.append({"envelope": "General", "amount": remaining})

    return {
        "transaction_id": tid,
        "amount": data.amount,
        "label": data.label,
        "allocations": allocations,
    }


@router.post("/api/withdraw")
def withdraw(data: WithdrawIn, user: dict = Depends(auth.get_current_user)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    success, msg = database.withdraw_from_envelope(user["id"], data.envelope_id, data.amount, data.note)
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    return {"message": msg}


@router.get("/api/transactions")
def list_transactions(
    label: str = Query("all"),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    search: Optional[str] = Query(None),
    user: dict = Depends(auth.get_current_user),
):
    return database.get_transactions(user["id"], label, sort_by, sort_order, search)
