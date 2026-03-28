#!/bin/bash
exec node --experimental-strip-types /root/.openclaw/tools/claw-kb/src/index.ts "$@"
