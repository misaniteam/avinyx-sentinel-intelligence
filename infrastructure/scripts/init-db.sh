#!/bin/bash
set -e

echo "Running database migrations..."
cd /home/vicky/mirasys/avinyx-sentinel-intelligence
PYTHONPATH=packages/shared:$PYTHONPATH alembic upgrade head
echo "Migrations complete."
