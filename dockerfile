# ---------- Build Frontend ----------
FROM node:18 AS frontend-build
WORKDIR /app/frontend

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source and build React app
COPY frontend/ ./
RUN npm run build

# ---------- Build Backend ----------
FROM python:3.11-slim AS backend-build
WORKDIR /app

# Install system dependencies needed for Pillow/imagehash
RUN apt-get update && apt-get install -y \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend

# ---------- Final Image ----------
FROM nginx:1.25

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-pip \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend and requirements
COPY --from=backend-build /app/backend ./backend
COPY backend/requirements.txt .

# Create virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies inside virtual environment
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn flask-cors pillow imagehash

# Copy frontend build
COPY --from=frontend-build /app/frontend/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80

# Entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
