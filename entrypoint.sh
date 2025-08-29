#!/bin/bash
# Start Nginx in the background
nginx -g "daemon off;" &

# Start Gunicorn in the foreground
exec gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app
