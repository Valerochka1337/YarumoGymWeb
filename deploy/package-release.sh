#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
npm run build
version=$(node -p 'require("./package.json").version')
mkdir -p releases
tar -czf "releases/yarumo-web-$version.tar.gz" -C dist .
shasum -a 256 "releases/yarumo-web-$version.tar.gz"
