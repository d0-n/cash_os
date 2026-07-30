from fastapi import APIRouter, HTTPException, Depends
from app import database, auth
from app.schemas import GoalUpdate

router = APIRouter()

@router.get("/api/goal")
def get_goal(user: dict = Depends(auth.get_current_user)):
    return database.get_goal_progress(user["id"])

@router.put("/api/goal")
def update_goal(data: GoalUpdate, user: dict = Depends(auth.get_current_user)):
    if data.target_amount <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be positive.")
    database.update_user_goal(user["id"], data.target_amount, data.title, data.target_date)
    return {"message": "Goal target updated."}

@router.get("/api/goals")
def list_goals(user: dict = Depends(auth.get_current_user)):
    return database.get_user_goals(user["id"])

@router.post("/api/goals")
def create_goal(data: GoalUpdate, user: dict = Depends(auth.get_current_user)):
    if data.target_amount <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be positive.")
    gid = database.create_goal(user["id"], data.title or "Goal Target", data.target_amount, data.target_date)
    return {"id": gid, "message": "Goal created successfully."}

@router.put("/api/goals/{goal_id}")
def edit_goal(goal_id: int, data: GoalUpdate, user: dict = Depends(auth.get_current_user)):
    if data.target_amount <= 0:
        raise HTTPException(status_code=400, detail="Target amount must be positive.")
    database.update_goal(user["id"], goal_id, data.title or "Goal Target", data.target_amount, data.target_date)
    return {"message": "Goal updated successfully."}

@router.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int, user: dict = Depends(auth.get_current_user)):
    database.delete_goal(user["id"], goal_id)
    return {"message": "Goal deleted successfully."}
