#!/bin/sh
set -e

# containers on linux share file permissions with hosts.
# assigning the same uid/gid from the host user
# ensures that the files can be read/write from both sides
if ! id lnd > /dev/null 2>&1; then
  USERID=${USERID:-1000}
  GROUPID=${GROUPID:-1000}

  echo "adding user lnd ($USERID:$GROUPID)"
  groupadd -f -g $GROUPID lnd
  useradd -M -u $USERID -g $GROUPID lnd
  chown -R $USERID:$GROUPID /home/lnd
fi

if [ $(echo "$1" | cut -c1) = "-" ]; then
  echo "$0: assuming arguments for lnd"

  set -- lnd "$@"
fi

if [ "$1" = "lnd" ] || [ "$1" = "lncli" ]; then
  echo "Running as lnd user: $@"
  exec gosu lnd "$@"
fi

echo "$@"
exec "$@"
