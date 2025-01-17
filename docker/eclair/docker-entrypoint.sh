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
  useradd -M -u $USERID -g $GROUPID eclair
  # ensure correct ownership of user home dir
  mkdir -p /home/eclair
  chown -R $USERID:$GROUPID /home/eclair
fi

if [ "$1" = "polar-eclair" ]; then
  # convert command line args to JAVA_OPTS
  JAVA_OPTS=""
  for arg in "$@"
  do
    if [ "${arg:0:21}" = "--server.public-ips.0" ]; then
      # replace the hostname provided in this arg with the IP address of the containing
      # because Eclair v8+ began including the DNS hostname in the NodeAnnouncements and
      # LND throws an error when parsing these messages
      JAVA_OPTS="$JAVA_OPTS -Declair.server.public-ips.0=$(hostname -i)"
    elif [ "${arg:0:2}" = "--" ]; then
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
