# ---------- Build Frontend ----------
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend

# Install only production dependencies
COPY frontend/package*.json ./
RUN npm ci --only=production

# Build React app
COPY frontend/ ./
RUN npm run build

# ---------- Build Backend ----------
FROM python:3.11-slim AS backend-build
WORKDIR /app

# Install Python dependencies in a virtualenv
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn flask-cors pillow imagehash

# Copy backend code
COPY backend/ ./backend

# ---------- Final Image ----------
WORKDIR /app
FROM nginx:1.25

# Install Python runtime (slim)
RUN apk add --no-cache python3 py3-pip bash && \
    python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy backend code & dependencies
COPY --from=backend-build /venv /venv
COPY --from=backend-build /app/backend ./backend

# Copy frontend build to nginx html
COPY --from=frontend-build /app/frontend/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose ports
EXPOSE 80

# Entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
