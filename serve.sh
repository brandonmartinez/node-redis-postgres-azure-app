#!/usr/bin/env bash

# Install and use a specific version of Node.js
nvm install
nvm use
npm install

# Source the .env file
set -a
source .env
set +a

# Run index.js
node index.js