
import os
import io
import uuid
import json
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from PIL import Image
import imagehash
import tempfile
import zipfile

APP_ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = APP_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

HASH_INDEX_FILE = UPLOAD_DIR / "hash_index.json"
if HASH_INDEX_FILE.exists():
    with open(HASH_INDEX_FILE, "r") as f:
        try:
            HASH_INDEX = json.load(f)  # {hash: stored_filename}
        except json.JSONDecodeError:
            HASH_INDEX = {}
else:
    HASH_INDEX = {}

# One shared password for zip downloads
DOWNLOAD_PASSWORD = os.getenv("DOWNLOAD_PASSWORD", "supersecret")

app = FastAPI(title="Photo Gallery API")

# CORS for development; restrict origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def perceptual_hash(file_bytes: bytes) -> str:
    """Return a perceptual hash string for given image bytes."""
    image = Image.open(io.BytesIO(file_bytes))
    phash = imagehash.average_hash(image)  # robust to metadata/quality changes
    return str(phash)


@app.get("/images")
async def list_images():
    """Public list of images for the gallery (filenames + URLs)."""
    files = []
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.name != HASH_INDEX_FILE.name:
            files.append({ "filename": f.name, "url": f"/uploads/{f.name}" })
    # Sort newest first
    files.sort(key=lambda x: (UPLOAD_DIR / x["filename"]).stat().st_mtime, reverse=True)
    return files


@app.post("/upload")
async def upload(files: List[UploadFile]):
    """Upload multiple images; generate unique names; detect perceptual duplicates."""
    uploaded = []
    for file in files:
        content = await file.read()
        try:
            h = perceptual_hash(content)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid image: {file.filename}")

        # Duplicate (perceptual) → reuse stored file
        if h in HASH_INDEX:
            stored_name = HASH_INDEX[h]
            uploaded.append({
                "original": file.filename,
                "stored": stored_name,
                "duplicate": True,
                "url": f"/uploads/{stored_name}"
            })
            continue

        # New file → unique filename, keep extension
        ext = os.path.splitext(file.filename)[1] or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        filepath = UPLOAD_DIR / unique_name
        with open(filepath, "wb") as buffer:
            buffer.write(content)

        HASH_INDEX[h] = unique_name
        uploaded.append({
            "original": file.filename,
            "stored": unique_name,
            "duplicate": False,
            "url": f"/uploads/{unique_name}"
        })

    # persist index
    with open(HASH_INDEX_FILE, "w") as f:
        json.dump(HASH_INDEX, f)

    return {"uploaded": uploaded}


@app.post("/download")
async def download_images(filenames: List[str], x_password: str = Header(None)):
    """Password-protected bulk download as a ZIP (shared secret)."""
    if x_password != DOWNLOAD_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Validate requested files
    files_to_zip = []
    for name in filenames:
        p = UPLOAD_DIR / name
        if p.exists() and p.is_file():
            files_to_zip.append(p)
    if not files_to_zip:
        raise HTTPException(status_code=404, detail="No valid files requested")

    # Create a temp ZIP
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files_to_zip:
            z.write(f, arcname=f.name)

    return FileResponse(tmp.name, media_type="application/zip", filename="photos_bundle.zip")
