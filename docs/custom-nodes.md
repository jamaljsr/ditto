# Build Custom Node Images

Polar v1.0.0 supports using custom docker images for nodes in your networks. The instructions below will walk you through the process of creating custom images using the `master` branch of each implementation. There are some limitations, such as running as a non-root user to be compatible across multiple platforms. Feel free to customize these Dockerfiles to your specific needs.

> Note: The Dockerfiles for each implementation will likely change in the future. Please be mindful to make updates as needed when necessary.

- [LND](#LND)
- [c-lightning](#c-lightning)
- [Eclair](#Eclair)

## LND

1. `git clone https://github.com/lightningnetwork/lnd`
1. `cd lnd`
1. Overwrite `Dockerfile` with the following:

   ```
   FROM golang:1.19.7-alpine as builder

   # Force Go to use the cgo based DNS resolver. This is required to ensure DNS
   # queries required to connect to linked containers succeed.
   ENV GODEBUG netdns=cgo

   # Pass a tag, branch or a commit using build-arg.  This allows a docker
   # image to be built from a specified Git state.  The default image
   # will use the Git tip of master by default.
   ARG checkout="master"

   # Install dependencies and build the binaries.
   RUN apk add --no-cache --update alpine-sdk \
       git \
       make \
       gcc \
   &&  git clone https://github.com/lightningnetwork/lnd /go/src/github.com/lightningnetwork/lnd \
   &&  cd /go/src/github.com/lightningnetwork/lnd \
   &&  git checkout $checkout \
   &&  make \
   &&  make install tags="signrpc walletrpc chainrpc invoicesrpc routerrpc"

   # Start a new, final image.
   FROM alpine as final

   # Define a root volume for data persistence.
   VOLUME /root/.lnd

   # Add bash and ca-certs, for quality of life and SSL-related reasons.
   RUN apk --no-cache add \
       bash \
       su-exec \
       ca-certificates

   # Copy the binaries from the builder image.
   COPY --from=builder /go/bin/lncli /bin/
   COPY --from=builder /go/bin/lnd /bin/

   COPY docker-entrypoint.sh /entrypoint.sh

   RUN chmod a+x /entrypoint.sh
   # Expose lnd ports (p2p, rpc).
   VOLUME ["/home/lnd/.lnd"]

   EXPOSE 9735 8080 10000

   # Specify the start command and entrypoint as the lnd daemon.
   ENTRYPOINT ["/entrypoint.sh"]

   CMD ["lnd"]
   ```

1. Create a new file named `docker-entrypoint.sh` with the following contents

   ```
   #!/bin/sh
   set -e

   # containers on linux share file permissions with hosts.
   # assigning the same uid/gid from the host user
   # ensures that the files can be read/write from both sides
   if ! id lnd > /dev/null 2>&1; then
     USERID=${USERID:-1000}
     GROUPID=${GROUPID:-1000}

     echo "adding user lnd ($USERID:$GROUPID)"
     addgroup -g $GROUPID lnd
     adduser -D -u $USERID -G lnd lnd
   fi

   if [ $(echo "$1" | cut -c1) = "-" ]; then
     echo "$0: assuming arguments for lnd"

     set -- lnd "$@"
   fi

   if [ "$1" = "lnd" ] || [ "$1" = "lncli" ]; then
     echo "Running as lnd user: $@"
     exec su-exec lnd "$@"
   fi

   echo "$@"
   exec "$@"

   ```

1. `docker build -t lnd-master .` or for a fresh build run `docker build --no-cache -t lnd-master .`

### c-lightning

1. `git clone https://github.com/ElementsProject/lightning.git`
1. `cd lightning`
1. Add the following to the end of the `Dockerfile`:

   ```
    # install gosu
    RUN apt-get update -y \
      && apt-get install -y curl gosu git \
      && apt-get clean \
      && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

    # download CLN bash completion file
    RUN curl -SLO https://raw.githubusercontent.com/ElementsProject/lightning/master/contrib/lightning-cli.bash-completion \
      && mv lightning-cli.bash-completion /etc/bash_completion.d/lightning-cli

    # install lightning-cli bash completion
    RUN curl -SLO https://raw.githubusercontent.com/scop/bash-completion/master/bash_completion \
      && mv bash_completion /usr/share/bash-completion/

    COPY docker-entrypoint.sh /entrypoint.sh
    COPY bashrc /home/clightning/.bashrc

    RUN chmod a+x /entrypoint.sh

    VOLUME ["/home/clightning"]

    EXPOSE 9735 9835 8080 10000

    ENTRYPOINT ["/entrypoint.sh"]

    CMD ["lightningd"]
   ```

1. Create a new file named `docker-entrypoint.sh` and copy the contents of [docker-entrypoint.sh](../docker/clightning/docker-entrypoint.sh)
   into it.

1. Run `docker build -t core-lightning-master .`

## Eclair

1. `git clone https://github.com/ACINQ/eclair.git`
1. `cd eclair`
1. Overwrite `Dockerfile` with the following:

   ```
   FROM adoptopenjdk/openjdk11:jdk-11.0.3_7-alpine as BUILD

   # Setup maven, we don't use https://hub.docker.com/_/maven/ as it declare .m2 as volume, we loose all mvn cache
   # We can alternatively do as proposed by https://github.com/carlossg/docker-maven#packaging-a-local-repository-with-the-image
   # this was meant to make the image smaller, but we use multi-stage build so we don't care
   RUN apk add --no-cache curl tar bash

   ARG MAVEN_VERSION=3.9.2
   ARG USER_HOME_DIR="/root"
   ARG SHA=900bdeeeae550d2d2b3920fe0e00e41b0069f32c019d566465015bdd1b3866395cbe016e22d95d25d51d3a5e614af2c83ec9b282d73309f644859bbad08b63db
   ARG BASE_URL=https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries

   RUN mkdir -p /usr/share/maven /usr/share/maven/ref \
     && curl -fsSL -o /tmp/apache-maven.tar.gz ${BASE_URL}/apache-maven-${MAVEN_VERSION}-bin.tar.gz \
     && echo "${SHA}  /tmp/apache-maven.tar.gz" | sha512sum -c - \
     && tar -xzf /tmp/apache-maven.tar.gz -C /usr/share/maven --strip-components=1 \
     && rm -f /tmp/apache-maven.tar.gz \
     && ln -s /usr/share/maven/bin/mvn /usr/bin/mvn

   ENV MAVEN_HOME /usr/share/maven
   ENV MAVEN_CONFIG "$USER_HOME_DIR/.m2"

   # Let's fetch eclair dependencies, so that Docker can cache them
   # This way we won't have to fetch dependencies again if only the source code changes
   # The easiest way to reliably get dependencies is to build the project with no sources
   WORKDIR /usr/src
   COPY pom.xml pom.xml
   COPY eclair-core/pom.xml eclair-core/pom.xml
   COPY eclair-front/pom.xml eclair-front/pom.xml
   COPY eclair-node/pom.xml eclair-node/pom.xml
   COPY eclair-node/modules/assembly.xml eclair-node/modules/assembly.xml
   RUN mkdir -p eclair-core/src/main/scala && touch eclair-core/src/main/scala/empty.scala
   # Blank build. We only care about eclair-node, and we use install because eclair-node depends on eclair-core
   #################### Polar Modification
   ENV MAVEN_OPTS=-Xmx256m -XX:MaxPermSize=512m
   ####################
   RUN mvn install -pl eclair-node -am
   RUN mvn clean

   # Only then do we copy the sources
   COPY . .

   # And this time we can build in offline mode, specifying 'notag' instead of git commit
   RUN mvn package -pl eclair-node -am -DskipTests -Dgit.commit.id=notag -Dgit.commit.id.abbrev=notag -o
   # It might be good idea to run the tests here, so that the docker build fail if the code is bugged

   # We currently use a debian image for runtime because of some jni-related issue with sqlite
   FROM openjdk:11.0.4-jre-slim
   WORKDIR /app

   # install jq for eclair-cli
   RUN apt-get update && apt-get install -y bash jq curl unzip gosu

   # copy and install eclair-cli executable
   COPY --from=BUILD /usr/src/eclair-core/eclair-cli .
   RUN chmod +x eclair-cli && mv eclair-cli /sbin/eclair-cli

   # we only need the eclair-node.zip to run
   COPY --from=BUILD /usr/src/eclair-node/target/eclair-node-*.zip ./eclair-node.zip
   RUN unzip eclair-node.zip && mv eclair-node-* eclair-node && chmod +x eclair-node/bin/eclair-node.sh

   #################### Polar Modification
   # Original lines:
   # ENV ECLAIR_DATADIR=/data
   # ENV JAVA_OPTS=
   # RUN mkdir -p "$ECLAIR_DATADIR"
   # VOLUME [ "/data" ]
   # ENTRYPOINT JAVA_OPTS="${JAVA_OPTS}" eclair-node/bin/eclair-node.sh "-Declair.datadir=${ECLAIR_DATADIR}"
   ENV ECLAIR_DATADIR=/home/eclair/
   RUN chmod -R a+x eclair-node/*
   RUN ls -al eclair-node/bin

   COPY docker-entrypoint.sh /entrypoint.sh

   RUN chmod a+x /entrypoint.sh

   VOLUME ["/home/eclair"]

   EXPOSE 9735 8080

   ENTRYPOINT ["/entrypoint.sh"]

   CMD $JAVA_OPTS bash eclair-node/bin/eclair-node.sh -Declair.datadir=$ECLAIR_DATADIR
   ####################

   ```

1. Create a new file named `docker-entrypoint.sh` with the following contents

   ```
   #!/usr/bin/env bash
   set -e

   # give bitcoind a second to bootup
   sleep 1

   # containers on linux share file permissions with hosts.
   # assigning the same uid/gid from the host user
   # ensures that the files can be read/write from both sides
   if ! id eclair > /dev/null 2>&1; then
     USERID=${USERID:-1000}
     GROUPID=${GROUPID:-1000}

     echo "adding user eclair ($USERID:$GROUPID)"
     groupadd -f -g $GROUPID eclair
     useradd -r -u $USERID -g $GROUPID eclair
     # ensure correct ownership of user home dir
     mkdir -p /home/eclair
     chown eclair:eclair /home/eclair
   fi

   if [ "$1" = "polar-eclair" ]; then
     # convert command line args to JAVA_OPTS
     JAVA_OPTS=""
     for arg in "$@"
     do
       if [ "${arg:0:2}" = "--" ]; then
         JAVA_OPTS="$JAVA_OPTS -Declair.${arg:2}"
       fi
     done
     # trim leading/trailing whitespace
     JAVA_OPTS="$(sed -e 's/[[:space:]]*$//' <<<${JAVA_OPTS})"

     echo "Running as eclair user:"
     echo "bash eclair-node/bin/eclair-node.sh $JAVA_OPTS"
     exec gosu eclair bash eclair-node/bin/eclair-node.sh $JAVA_OPTS
   fi

   echo "Running: $@"
   exec "$@"
   ```

1. `docker build -t eclair-master .`
