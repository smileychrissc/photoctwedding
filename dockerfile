# Stage 1: Build React frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Python backend
FROM python:3.11-slim AS backend-build
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY backend/ ./backend

# Stage 3: Final image with Nginx + Gunicorn + UI
FROM nginx:alpine
WORKDIR /app

# Install Python + Gunicorn
RUN apk add --no-cache python3 py3-pip bash && \
    pip3 install --upgrade pip

COPY --from=backend-build /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=backend-build /usr/local/bin/gunicorn /usr/local/bin/gunicorn
COPY --from=backend-build /app/backend /app/backend

# Copy React build into nginx html folder
COPY --from=frontend-build /app/frontend/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTP & HTTPS
EXPOSE 80 443

# Start Gunicorn and Nginx
CMD sh -c "\
    gunicorn -w 4 -b 127.0.0.1:8000 backend.app:app & \
    nginx -g 'daemon off;'"
