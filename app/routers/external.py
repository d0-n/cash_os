import os
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from app import database, auth

router = APIRouter()

EXCHANGE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
_rate_cache = {"rates": None, "fetched_at": None}

@router.get("/api/exchange-rate")
async def exchange_rate():
    global _rate_cache

    if _rate_cache["rates"] and _rate_cache["fetched_at"]:
        if datetime.now() - _rate_cache["fetched_at"] < timedelta(hours=24):
            return {"rates": _rate_cache["rates"], "cached": True}

    if not EXCHANGE_API_KEY:
        return {"rates": {"USD": 0.00074, "EUR": 0.00068, "KES": 0.095, "GBP": 0.00058}, "cached": True}

    url = f"https://v6.exchangerate-api.com/v6/{EXCHANGE_API_KEY}/latest/RWF"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers={"User-Agent": "CashOS/1.0"})
            response.raise_for_status()
            data = response.json()

        if data.get("result") != "success":
            if _rate_cache["rates"]:
                return {"rates": _rate_cache["rates"], "cached": True}
            return {"rates": {"USD": 0.00074, "EUR": 0.00068, "KES": 0.095, "GBP": 0.00058}, "cached": True}

        rates = data["conversion_rates"]
        _rate_cache = {
            "rates": {
                "USD": rates.get("USD"),
                "EUR": rates.get("EUR"),
                "KES": rates.get("KES"),
                "GBP": rates.get("GBP"),
            },
            "fetched_at": datetime.now(),
        }
        return {"rates": _rate_cache["rates"], "cached": False}

    except Exception:
        return {"rates": {"USD": 0.00074, "EUR": 0.00068, "KES": 0.095, "GBP": 0.00058}, "cached": True}


@router.get("/api/summary")
async def get_summary(user: dict = Depends(auth.get_current_user)):
    progress = database.get_goal_progress(user["id"])
    rates_res = await exchange_rate()
    usd_rate = rates_res.get("rates", {}).get("USD", 0.00074)
    return {
        "total_balance": progress["total"],
        "target": progress["target"],
        "goal_title": progress["title"],
        "target_date": progress["target_date"],
        "usd_rate": usd_rate
    }
