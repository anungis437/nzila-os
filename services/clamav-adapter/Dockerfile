# syntax=docker/dockerfile:1
#
# Union Eyes — ClamAV HTTP scanning adapter
#
# Wraps the official, signature-preloaded ClamAV image with a minimal HTTP
# API (POST /scan, GET /health) speaking clamd's native INSTREAM protocol.
# The base image ships its signature database pre-baked at publish time, so
# clamd has a database to load even when this container's runtime network
# egress to ClamAV's definition mirrors is restricted; freshclam still runs
# and updates the database opportunistically but never blocks clamd from
# starting on it (verified locally: clamd's socket comes up in both
# CLAMAV_NO_FRESHCLAMD=true and the default freshclam-enabled configuration).
#
# Image selection: the non-"_base" tag (preloaded signatures), pinned by
# digest per docs.clamav.net/manual/Installing/Docker.html's recommendation
# to track a feature release rather than a moving "stable"/"latest" tag.
FROM clamav/clamav@sha256:cbc30de94b6e9b33ac14136ff45306cee02a1f9ae522394a3cc5b9215d1affe9

RUN apk add --no-cache nodejs

COPY server.js /opt/clamav-adapter/server.js
COPY start.sh /opt/clamav-adapter/start.sh
RUN chmod +x /opt/clamav-adapter/start.sh

EXPOSE 8080 3310

ENTRYPOINT ["/opt/clamav-adapter/start.sh"]
