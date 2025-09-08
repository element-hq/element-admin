#!/bin/sh

set -eux

# In the index.html, we have a variable injected which stores the runtime
# configuration as a base64 encoded JSON string. This script replaces that
# variable with the actual configuration.
#
# The Dockerfile sets up a symlink from /tmp/index.runtime.html to
# /dist/index.runtime.html, which nginx will try to load (see docker/nginx.conf)
# falling back to /dist/index.html

SOURCE=/dist/index.html
DEST=/tmp/index.runtime.html
SERVER_NAME="${SERVER_NAME:-}"

CONFIG=$(base64 <<EOF
{
  "serverName": "$SERVER_NAME"
}
EOF
)

sed "s/APP_CONFIG_PLACEHOLDER/${CONFIG}/" "$SOURCE" > "$DEST"
