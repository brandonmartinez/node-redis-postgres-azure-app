#!/usr/bin/env bash

# Configure local environment and logging
##################################################
set -eo pipefail
set -a

LOG_FILE_NAME="serve.log"

source ./logging.sh

# Load environment file
source .env

set +a

# Setup node environment
##################################################
section "Setting up Node environment"

info "Installing Node dependencies"
npm install

# Launch the app
##################################################
section "Launching the app"

node index.js