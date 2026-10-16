FROM redis@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499
# Staging-only, non-persistent rate-limit store. The password comes from the REDIS_PASSWORD secret.
ENTRYPOINT ["sh","-c","exec redis-server --requirepass \"$REDIS_PASSWORD\" --save '' --appendonly no --maxmemory 128mb --maxmemory-policy allkeys-lru"]
