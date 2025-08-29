# ---------- Build Frontend ----------
FROM node:18 AS frontend-build
WORKDIR /app/frontend

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm install

# Build React app
COPY frontend/ ./
RUN npm run build

# ---------- Build Backend ----------
FROM python:3.11-slim AS backend-build
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend

# ---------- Final Image ----------
FROM nginx:1.25

# Install Python and Gunicorn inside nginx container
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Copy backend code
WORKDIR /app
COPY --from=backend-build /app/backend ./backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy frontend build to nginx html
COPY --from=frontend-build /app/frontend/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose only HTTP
EXPOSE 80

# Start Gunicorn and Nginx
CMD gunicorn -w 4 -b 127.0.0.1:5000 backend.app:app & nginx -g "daemon off;"
