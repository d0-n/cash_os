from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app import database
from app.routers import auth_routes, envelopes, rules, transactions, goals, external

app = FastAPI(title="Cash OS")

@app.on_event("startup")
def on_startup():
    database.init_db()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def landing():
    return FileResponse("static/index.html")

@app.get("/dashboard")
def dashboard():
    return FileResponse("static/index.html")

app.include_router(auth_routes.router)
app.include_router(envelopes.router)
app.include_router(rules.router)
app.include_router(transactions.router)
app.include_router(goals.router)
app.include_router(external.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
