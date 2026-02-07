#!/bin/bash
#
# Mission Control Data Generator (wrapper)
# Calls the Node.js build script
#
# Usage: ./build.sh
# Can be run manually or via cron

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/build.js" "$@"
