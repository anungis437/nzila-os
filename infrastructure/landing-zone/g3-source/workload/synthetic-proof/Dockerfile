FROM docker.io/library/golang@sha256:bcef992b77b1e2031aaaa51da75cebc32da8e9c182e12e633ea79023c79d9eff AS compiler
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off TZ=UTC
WORKDIR /src
COPY go.mod ./
COPY main.go main_test.go ./
RUN --network=none go test -count=1 -v ./... && go vet ./...
RUN --network=none mkdir /out \
    && go build -a -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o /out/proof-server-a . \
    && go build -a -trimpath -buildvcs=false -ldflags="-s -w -buildid=" -o /out/proof-server-b . \
    && cmp /out/proof-server-a /out/proof-server-b \
    && sha256sum /out/proof-server-a /out/proof-server-b

FROM scratch AS runtime
COPY --from=compiler /out/proof-server-a /proof-server
USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["/proof-server"]
