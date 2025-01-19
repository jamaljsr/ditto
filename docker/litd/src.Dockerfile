# Start with a NodeJS base image that also contains yarn.
FROM node:22.13.0-alpine@sha256:f2dc6eea95f787e25f173ba9904c9d0647ab2506178c7b5b7c5a3d02bc4af145 as nodejsbuilder

ARG LITD_VERSION

RUN apk add --no-cache --update git

# Copy in the local repository to build from.
RUN git clone --branch ${LITD_VERSION} https://github.com/lightninglabs/lightning-terminal.git /go/src/github.com/lightninglabs/lightning-terminal/

RUN cd /go/src/github.com/lightninglabs/lightning-terminal/app \
  && yarn install \
  && yarn build

# The first stage is already done and all static assets should now be generated
# in the app/build sub directory.
# If you change this value, please also update:
# /Dockerfile
# /.github/workflows/main.yml
FROM golang:1.23-bookworm as golangbuilder

# Instead of checking out from git again, we just copy the whole working
# directory of the previous stage that includes the generated static assets.
COPY --from=nodejsbuilder /go/src/github.com/lightninglabs/lightning-terminal /go/src/github.com/lightninglabs/lightning-terminal

# Force Go to use the cgo based DNS resolver. This is required to ensure DNS
# queries required to connect to linked containers succeed.
ENV GODEBUG netdns=cgo

# Install dependencies and install/build lightning-terminal.
# RUN apk add --no-cache --update alpine-sdk \
#   make \
#   && cd /go/src/github.com/lightninglabs/lightning-terminal \
#   && make go-install \
#   && make go-install-cli

RUN apt-get update -y \
  && apt-get install -y make \
  && cd /go/src/github.com/lightninglabs/lightning-terminal \
  && make go-install \
  && make go-install-cli

FROM debian:stable-slim

ENV PATH=/opt/litd:$PATH

RUN apt-get update -y \
  && apt-get install -y curl gosu wait-for-it \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy the binaries and entrypoint from the builder image.
COPY --from=golangbuilder /go/bin/litd /bin/
COPY --from=golangbuilder /go/bin/litcli /bin/
COPY --from=golangbuilder /go/bin/lncli /bin/
COPY --from=golangbuilder /go/bin/frcli /bin/
COPY --from=golangbuilder /go/bin/loop /bin/
COPY --from=golangbuilder /go/bin/pool /bin/
COPY --from=golangbuilder /go/bin/tapcli /bin/

COPY docker-entrypoint.sh /entrypoint.sh

RUN chmod a+x /entrypoint.sh

VOLUME ["/home/litd/.litd"]

EXPOSE 8443 10009 9735

ENTRYPOINT ["/entrypoint.sh"]

CMD ["litd"]