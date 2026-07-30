from pydantic import BaseModel
from typing import Optional

class RegisterIn(BaseModel):
    username: str
    password: str

class LoginIn(BaseModel):
    username: str
    password: str

class EnvelopeIn(BaseModel):
    name: str
    goal: Optional[float] = None
    goal_date: Optional[str] = None
    color: Optional[str] = "#2c6fce"

class RuleIn(BaseModel):
    label: str
    envelope_id: int
    type: str
    value: float
    priority: Optional[int] = 0

class DepositIn(BaseModel):
    amount: float
    label: str
    note: Optional[str] = None

class GoalUpdate(BaseModel):
    target_amount: float
    title: Optional[str] = "Savings Target"
    target_date: Optional[str] = None

class WithdrawIn(BaseModel):
    envelope_id: int
    amount: float
    note: Optional[str] = None
