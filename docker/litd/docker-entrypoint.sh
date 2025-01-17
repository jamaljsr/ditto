#!/bin/sh
set -e

# containers on linux share file permissions with hosts.
# assigning the same uid/gid from the host user
# ensures that the files can be read/write from both sides
if ! id litd > /dev/null 2>&1; then
  USERID=${USERID:-1000}
  GROUPID=${GROUPID:-1000}

  echo "adding user litd ($USERID:$GROUPID)"
  groupadd -f -g $GROUPID litd
  useradd -M -u $USERID -g $GROUPID litd
  chown -R $USERID:$GROUPID /home/litd
fi

if [ $(echo "$1" | cut -c1) = "-" ]; then
  echo "$0: assuming arguments for litd"

  set -- litd "$@"
fi

if [ "$1" = "litd" ] || [ "$1" = "litcli" ]; then
  echo "Running as litd user: $@"
  exec gosu litd "$@"
fi

echo "$@"
exec "$@"
