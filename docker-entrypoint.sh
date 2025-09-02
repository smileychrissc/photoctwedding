#!/bin/bash
# Replace REACT_APP_API_BASE in config.js at container runtime
if [ -n "$REACT_APP_API_BASE" ]; then
  echo "Setting runtime API base to $REACT_APP_API_BASE"
  sed -i "s|REACT_APP_API_BASE: .*|REACT_APP_API_BASE: \"$REACT_APP_API_BASE\"|g" /usr/share/nginx/html/config.js
fi

# Start Gunicorn backend
gunicorn -w 4 -b 0.0.0.0:5000 backend.main:app &


# Start nginx in foreground
nginx -g "daemon off;"
