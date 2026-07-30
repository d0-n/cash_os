from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app import database, auth
from app.schemas import RegisterIn, LoginIn

router = APIRouter()

@router.post("/api/register")
def register(data: RegisterIn):
    username = data.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    hashed = auth.hash_password(data.password)
    uid = database.create_user(username, hashed)
    if uid is None:
        raise HTTPException(status_code=409, detail="Username already taken.")

    database.seed_defaults(uid)
    token = auth.create_token(uid, username)
    return {"token": token, "username": username}

@router.post("/api/token")
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = database.get_user_by_username(form.username)
    if not user or not auth.verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    token = auth.create_token(user["id"], user["username"])
    return {"access_token": token, "token_type": "bearer"}

@router.post("/api/login")
def login_json(data: LoginIn):
    user = database.get_user_by_username(data.username)
    if not user or not auth.verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    token = auth.create_token(user["id"], user["username"])
    return {"token": token, "username": user["username"]}
