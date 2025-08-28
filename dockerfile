# Base Python image
FROM python:3.11-slim

# Install system packages: nginx, supervisor, openssl for self-signed cert
RUN apt-get update && \
    apt-get install -y nginx supervisor openssl && \
    rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy backend source
COPY ./backend/*.py .

# Copy Nginx & Supervisor configs
COPY nginx.conf /etc/nginx/sites-available/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Generate self-signed certificate (valid 365 days)
RUN mkdir -p /etc/ssl/private && \
    openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout /etc/ssl/private/selfsigned.key \
    -out /etc/ssl/certs/selfsigned.crt \
    -subj "/CN=localhost"

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Start supervisord (manages Nginx + Gunicorn)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
