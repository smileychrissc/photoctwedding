#!/bin/bash
# Start Nginx in the background
nginx -g "daemon off;" &

# Start Gunicorn in the foreground
exec gunicorn -w 4 -b 127.0.0.1:8000 wsgi:app
