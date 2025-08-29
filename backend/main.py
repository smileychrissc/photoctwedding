
import os
import io
import uuid
import json
from pathlib import Path
from typing import List

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from PIL import Image
import imagehash
import tempfile
import zipfile

APP_ROOT = Path(__file__).resolve().parent
UPLOAD_DIR = APP_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

HASH_INDEX_FILE = UPLOAD_DIR / "hash_index.json"
if HASH_INDEX_FILE.exists():
    with open(HASH_INDEX_FILE, "r") as f:
        try:
            HASH_INDEX = json.load(f)  # {hash: stored_filename}
        except json.JSONDecodeError:
            HASH_INDEX = {}
else:
    HASH_INDEX = {}

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

# One shared password for zip downloads
DOWNLOAD_PASSWORD = os.getenv("DOWNLOAD_PASSWORD", "supersecret")

app = Flask(__name__)

# Allowed origins
allowed_origins = [
    "http://173.236.139.136",
    "https://173.236.139.136",
    "http://3.14.83.137",
    "https://3.14.83.137",
    "http://localhost:3000",   # React dev
    "http://127.0.0.1:3000"    # Alternative localhost
]
app.config["MAX_CONTENT_LENGTH"] = 70 * 1024 * 1024     # 70Mb

#CORS(app, resources={r"/*": {"origins": allowed_origins}})
CORS(app, resources={r"/*": {"origins": "*"}})   # allow all origins

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def perceptual_hash(file_bytes: bytes) -> str:
    """Return a perceptual hash string for given image bytes."""
    image = Image.open(io.BytesIO(file_bytes))
    phash = imagehash.average_hash(image)  # robust to metadata/quality changes
    return str(phash)


@app.route("/images", methods=["GET"])
def list_images():
    """Public list of images for the gallery (filenames + URLs)."""
    files = []
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.name != HASH_INDEX_FILE.name:
            files.append({ "filename": f.name, "url": f"/uploads/{f.name}" })
    # Sort newest first
    files.sort(key=lambda x: (UPLOAD_DIR / x["filename"]).stat().st_mtime, reverse=True)
    return files


@app.route("/upload", methods=["POST"])
def upload_images():
    """Upload multiple images; generate unique names; detect perceptual duplicates."""
    if "files" not in request.files:
        return jsonify({"error": "No images part"}), 400

    files = request.files.getlist("files")

    uploaded = []
    for file in files:
        if not file or not allowed_file(file.filename):
            continue

        content = file.read()
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
        print('HACK: WRITING:',filepath,flush=True)
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


@app.route("/download", methods=["POST"])
def download_multiple():
    """
    Expects:
    - Header: x-password: your_shared_password_here
    - JSON body: { "filenames": ["image1.jpg", "image2.png"] }
    """
    x_password = request.headers.get("x-password")
    if x_password != DOWNLOAD_PASSWORD:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Expecting a JSON array of filenames
    filenames = request.get_json()
    if not filenames or not isinstance(filenames, list):
        return jsonify({"error": "No filenames provided"}), 400

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


@app.route("/uploads/<filename>")
def serve_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/download/<filename>", methods=["GET"])
def download_image(filename):
    password = request.args.get("password")
    if password != DOWNLOAD_PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    return send_from_directory(UPLOAD_DIR, filename, as_attachment=True)

@app.after_request
def add_custom_headers(response):
    response.headers["X-App-Name"] = "Photo Gallery Backend"
    return response

