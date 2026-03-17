#!/bin/sh

# Copyright 2026 Element Creations Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the repository root for full details.

# Generate /tmp/listen.conf with the appropriate listen directives.
# This is included by the server block in default.conf.
# Writing to /tmp/ allows this to work on read-only root filesystems.

set -eu

LISTEN_CONF=/tmp/listen.conf

echo "listen 8080;" > "$LISTEN_CONF"

if [ -f /proc/net/if_inet6 ]; then
    echo "listen [::]:8080;" >> "$LISTEN_CONF"
fi
