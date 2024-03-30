#!/usr/bin/env bash

# Configure local environment and logging
##################################################
set -eo pipefail
set -a

LOG_FILE_NAME="serve.log"
# Uncomment the following line to enable verbose logging from Azure SDKs
# AZURE_LOG_LEVEL=verbose

source ./logging.sh

# Load environment file
source .env

if [[ "$USE_MANAGED_IDENTITIES" == "false" ]]; then
    info "Capturing current user entra details for deployment"
    output=$(az ad signed-in-user show --query "{user: userPrincipalName}")
    ENTRA_USER_EMAIL=$(echo "$output" | jq -r '.user')
fi

set +a

# Launch the app
##################################################
section "Launching the app"

cd app
node index.js
