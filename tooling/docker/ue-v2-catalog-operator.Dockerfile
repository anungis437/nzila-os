# Private catalogue operator. It is not the forward-upgrade entrypoint and it
# has no baked credentials. The qualified application image supplies node and pg.
ARG QUALIFIED_APPLICATION_IMAGE
FROM ${QUALIFIED_APPLICATION_IMAGE}
ARG OPERATOR_SOURCE_SHA
LABEL org.opencontainers.image.revision=${OPERATOR_SOURCE_SHA} \
      org.nzila.operation="ue-v2-staging-private-catalog" \
      org.nzila.console="none"
COPY operator.cjs /app/ue-catalog/operator.cjs
USER 1001:1001
ENTRYPOINT ["node", "/app/ue-catalog/operator.cjs"]
CMD []
