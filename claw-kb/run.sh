#!/bin/bash
exec node --experimental-strip-types ~/.openclaw/tools/claw-kb/src/index.ts "$@"
