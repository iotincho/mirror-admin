#!/bin/sh
set -eu
: "${ADMIN_ALLOWED_HOSTS:?ADMIN_ALLOWED_HOSTS must list the accepted LAN hostnames or IP addresses}"
# Validate the entire value, including newlines, before envsubst renders Nginx.
case "$ADMIN_ALLOWED_HOSTS" in
    *[!a-zA-Z0-9_.:\ -]*)
        echo 'ADMIN_ALLOWED_HOSTS contains invalid characters.' >&2
        exit 1 ;;
esac
if ! printf '%s\n' "$ADMIN_ALLOWED_HOSTS" | grep -Eq '^[a-zA-Z0-9_:-][a-zA-Z0-9_.:-]*( [a-zA-Z0-9_:-][a-zA-Z0-9_.:-]*)*$'; then
    echo 'ADMIN_ALLOWED_HOSTS must contain exact, space-separated hostnames/IPs.' >&2
    exit 1
fi
