#!/bin/bash
# Deploy PhoenixTrade via SSH to Coolify server
# Usage: ./scripts/coolify-deploy-via-ssh.sh [host]
# Example: ./scripts/coolify-deploy-via-ssh.sh root@69.62.86.166

set -e
HOST="${1:-root@69.62.86.166}"
APP_DIR="/data/coolify/applications/tsogksw8kg0kgkgoow048cgk"

echo "=== PhoenixTrade Coolify Deploy via SSH ==="
echo "Host: $HOST"
echo ""

echo "1. Checking container status..."
ssh "$HOST" "cd $APP_DIR && docker compose -f docker-compose.yaml ps -a" || true

echo ""
echo "2. To force rebuild and deploy from Coolify UI:"
echo "   - Open Coolify dashboard"
echo "   - Go to PhoenixTrade resource"
echo "   - Click Deploy -> Force Deploy (or enable Disabled Build Cache)"
echo ""
echo "3. To monitor deployment logs:"
echo "   ssh $HOST 'cd $APP_DIR && docker compose -f docker-compose.yaml logs -f'"
echo ""
echo "4. To check dashboard-ui image (should include Backtesting):"
echo "   ssh $HOST 'docker images | grep dashboard-ui'"
echo ""
