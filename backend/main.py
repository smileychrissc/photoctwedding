import os
import io
import uuid
import json
import tempfile
import zipfile
from pathlib import Path
from typing import List

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
from PIL import Image
import imagehash

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

# Shared password for downloads
DOWNLOAD_PASSWORD = os.getenv("DOWNLOAD_PASSWORD", "supersecret")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 70 * 1024 * 1024  # 70 MB

CORS(app, resources={r"/*": {"origins": "*"}})


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def perceptual_hash(file_bytes: bytes) -> str:
    """Return a perceptual hash string for given image bytes."""
    image = Image.open(io.BytesIO(file_bytes))
    phash = imagehash.average_hash(image)
    return str(phash)


@app.route("/images", methods=["GET"])
def list_images():
    """List uploaded images for the gallery."""
    files = []
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.name != HASH_INDEX_FILE.name:
            files.append({"filename": f.name, "url": f"/uploads/{f.name}"})
    # Sort newest first
    files.sort(key=lambda x: (UPLOAD_DIR / x["filename"]).stat().st_mtime, reverse=True)
    return jsonify(files)


@app.route("/upload", methods=["POST"])
def upload_images():
    """Upload multiple images with duplicate detection."""
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
            raise HTTPException(description=f"Invalid image: {file.filename}", code=400)

        # Duplicate
        if h in HASH_INDEX:
            stored_name = HASH_INDEX[h]
            uploaded.append({
                "original": file.filename,
                "stored": stored_name,
                "duplicate": True,
                "url": f"/uploads/{stored_name}"
            })
            continue

        # New file
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

    with open(HASH_INDEX_FILE, "w") as f:
        json.dump(HASH_INDEX, f)

    return jsonify({"uploaded": uploaded})


@app.route("/download", methods=["POST"])
def download_multiple():
    """
    Expects:
    - Header: x-password: your_shared_password_here
    - JSON body: ["image1.jpg", "image2.png"]
    """
    x_password = request.headers.get("x-password")
    if x_password != DOWNLOAD_PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    filenames = request.get_json()
    if not filenames or not isinstance(filenames, list):
        return jsonify({"error": "No filenames provided"}), 400

    files_to_zip = []
    for name in filenames:
        p = UPLOAD_DIR / name
        if p.exists() and p.is_file():
            files_to_zip.append(p)

    if not files_to_zip:
        return jsonify({"error": "No valid files requested"}), 404

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files_to_zip:
            z.write(f, arcname=f.name)

    from flask import send_file
    return send_file(tmp.name, mimetype="application/zip",
                     as_attachment=True, download_name="photos_bundle.zip")


@app.route("/uploads/<filename>")
def serve_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/download/<filename>", methods=["GET"])
def download_image(filename):
    password = request.args.get("password")
    if password != DOWNLOAD_PASSWORD:
        return jsonify({"error": "Unauthorized"}), 401

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        return jsonify({"error": "File not found"}), 404

    return send_from_directory(UPLOAD_DIR, filename, as_attachment=True)


@app.after_request
def add_custom_headers(response):
    response.headers["X-App-Name"] = "Photo Gallery Backend"
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
