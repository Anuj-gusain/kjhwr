import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.routers import dayahead, analytics, data
from backend.app.config import DB_PATH, BASE_DIR

app = FastAPI(
    title="UK Wind Day-Ahead Analytics & Procurement IQ",
    description="""
    Enterprise Analytics & Day-Ahead Wholesale Power Procurement API for UK Energy Utilities.
    
    Integrates National Grid ESO / Elexon BMRS streams:
    - **FUELHH**: Actual half-hourly wind generation (Settlement Periods 1-48)
    - **WINDFOR**: Rolling 72-hour forecast vintages published multiple times daily
    
    Provides day-ahead market gate closure decision matching, quantitative forecast error evaluation
    (MAE, RMSE, WAPE, Mean Bias, Diurnal Error Profiles, Quantiles/Confidence Bands), and thermal hedge procurement simulation.
    """,
    version="1.0.0",
)

# Configure CORS for local development and deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import Request, HTTPException

@app.get("/api/health")
def api_health():
    return {
        "service": "UK Wind Day-Ahead Analytics & Procurement IQ API",
        "version": "1.0.0",
        "status": "online",
        "database_connected": os.path.exists(DB_PATH),
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }

# Register API Routers first
app.include_router(dayahead.router)
app.include_router(analytics.router)
app.include_router(data.router)

# Mount frontend static files if built
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(BASE_DIR)), "frontend", "dist")
if not os.path.exists(FRONTEND_DIST):
    FRONTEND_DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str, request: Request):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail=f"API endpoint not found: /{full_path}")
        accept_header = request.headers.get("accept", "")
        if (full_path == "" or full_path == "/") and "application/json" in accept_header and "text/html" not in accept_header:
            return api_health()
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root():
        return api_health()
