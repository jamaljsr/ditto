#!/bin/sh
set -e

# give bitcoind a second to bootup
sleep 1

# containers on linux share file permissions with hosts.
# assigning the same uid/gid from the host user
# ensures that the files can be read/write from both sides
if ! id clightning > /dev/null 2>&1; then
  USERID=${USERID:-1000}
  GROUPID=${GROUPID:-1000}

  echo "adding user clightning ($USERID:$GROUPID)"
  groupadd -f -g $GROUPID clightning
  useradd -M -u $USERID -g $GROUPID clightning
  # ensure correct ownership of user home dir
  mkdir -p /home/clightning
  chown -R $USERID:$GROUPID /home/clightning
fi

if [ $(echo "$1" | cut -c1) = "-" ]; then
  echo "$0: assuming arguments for lightningd"

  set -- lightningd "$@"
fi

# TODO: investigate hsmd error on Windows
# https://gist.github.com/jamaljsr/404c20f99be2f77fff2d834e2449158b

if [ "$1" = "lightningd" ] || [ "$1" = "lightning-cli" ]; then
  echo "Running as clightning user: $@"
  exec gosu clightning "$@"
fi

echo "$@"
exec "$@"
