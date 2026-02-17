#!/bin/bash
# Start dev server in Docker with file watching
docker run --rm -it \
  -p 3000:3000 \
  -p 3001:3001 \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  -v /app/apps/web/node_modules \
  -v /app/apps/console/node_modules \
  -v /app/packages/ui/node_modules \
  -v /app/packages/config/node_modules \
  -w /app \
  --env-file apps/console/.env.local \
  $(docker build -q --target dev .) \
  pnpm dev
