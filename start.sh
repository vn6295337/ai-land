#!/bin/bash
exec gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 30 api_gateway:app