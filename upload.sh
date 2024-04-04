#!/usr/bin/env bash

# Configure local environment and logging
##################################################
set -eo pipefail
set -a

LOG_FILE_NAME="upload.log"
# Uncomment the following line to enable verbose logging from Azure SDKs
# AZURE_LOG_LEVEL=verbose
ALL_PROXY=socks5h://127.0.0.1:8080

source ./logging.sh

# Load environment file
source .env

set +a

# Configure Azure CLI
##################################################
section "Configuring AZ CLI"
if ! az account show &> /dev/null; then
    az login
fi

info "Setting Azure subscription to $AZURE_SUBSCRIPTIONID"
az account set --subscription "$AZURE_SUBSCRIPTIONID"

info "Setting default location to $AZURE_LOCATION and resource group to $AZURE_RESOURCEGROUP"
az configure --defaults location="$AZURE_LOCATION" group="$AZURE_RESOURCEGROUP"

# Upload Images to Azure Blob Storage
##################################################

az storage blob upload-batch --account-name "$AZURE_STORAGE_ACCOUNT_NAME" -d "$AZURE_STORAGE_ACCOUNT_CONTAINER_NAME" -s "./images/" --overwrite