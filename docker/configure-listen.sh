#!/bin/sh

# Copyright 2026 Element Creations Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
# Please see LICENSE files in the repository root for full details.

# Generate /tmp/listen.conf with the appropriate listen directives.
# This is included by the server block in default.conf.
# Writing to /tmp/ allows this to work on read-only root filesystems.
#
# Supports IPv4-only, IPv6-only, and dual-stack environments:
#  - IPv4 detected via /proc/net/fib_trie
#  - IPv6 detected via /proc/net/if_inet6

set -eu

LISTEN_CONF=/tmp/listen.conf

HAS_IPV4=false
HAS_IPV6=false

if [ -f /proc/net/fib_trie ]; then
    HAS_IPV4=true
fi

if [ -f /proc/net/if_inet6 ]; then
    HAS_IPV6=true
fi

: > "$LISTEN_CONF"

if [ "$HAS_IPV4" = true ] && [ "$HAS_IPV6" = true ]; then
    # Dual-stack: separate sockets
    echo "listen 8080;" >> "$LISTEN_CONF"
    echo "listen [::]:8080 ipv6only=on;" >> "$LISTEN_CONF"
elif [ "$HAS_IPV6" = true ]; then
    # IPv6 only
    echo "listen [::]:8080;" >> "$LISTEN_CONF"
else
    # IPv4 only (fallback)
    echo "listen 8080;" >> "$LISTEN_CONF"
fi
