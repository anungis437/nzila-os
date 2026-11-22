# Operations image only. It cannot replace the application release manifest.
ARG QUALIFIED_APPLICATION_IMAGE
FROM ${QUALIFIED_APPLICATION_IMAGE}
ARG OPERATOR_SOURCE_SHA
LABEL org.opencontainers.image.revision=${OPERATOR_SOURCE_SHA} \
      org.opencontainers.image.source="https://github.com/anungis437/nzila-os" \
      org.nzila.operation="ue-v2-staging-preserve-data-forward-upgrade" \
      org.nzila.application-source="57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3"
COPY forward-operator/ /app/ue-forward-upgrade/
ENV UE_UPGRADE_ASSETS=/app/ue-forward-upgrade/assets
USER 1001:1001
ENTRYPOINT ["node", "/app/ue-forward-upgrade/main.cjs"]
CMD []
