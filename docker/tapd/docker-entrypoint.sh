#!/bin/sh
set -e

# containers on linux share file permissions with hosts.
# assigning the same uid/gid from the host user
# ensures that the files can be read/write from both sides
if ! id tap > /dev/null 2>&1; then
  USERID=${USERID:-1000}
  GROUPID=${GROUPID:-1000}

  echo "adding user tap ($USERID:$GROUPID)"
  groupadd -f -g $GROUPID tap
  useradd -M -u $USERID -g $GROUPID tap
  chown -R $USERID:$GROUPID /home/tap
fi

if [ $(echo "$1" | cut -c1) = "-" ]; then
  echo "$0: assuming arguments for tapd"

  set -- tapd "$@"
fi

if [ "$1" = "tapd" ] || [ "$1" = "tapcli" ]; then
  echo "Running as tap user: $@"
  exec gosu tap "$@"
fi

echo "$@"
exec "$@"
