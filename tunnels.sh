#!/usr/bin/env bash

# Configure local environment and logging
##################################################
set -eo pipefail
set -a

LOG_FILE_NAME="tunnels.log"

source ./logging.sh

# Load environment file
source .env

# Variables for Tunnels
LOCAL_BASTION_SSH_TUNNEL_ADDRESS="127.0.0.1"
LOCAL_BASTION_SSH_TUNNEL_PORT=2022
POSTGRESS_PORT=5432
REDIS_PORT=6380
CURRENT_DIR=$(dirname "$0")
SSH_DIR="$CURRENT_DIR/.ssh"
SSH_PRIVATE_KEY_PATH="$SSH_DIR/$SSH_KEY_NAME"
SSH_PUBLIC_KEY_PATH="$SSH_PRIVATE_KEY_PATH.pub"
SSH_COMPLETE_FILE="$SSH_DIR/transfer_complete"

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

# Connecting to Azure Bastion
##################################################
section "Connecting to Azure Bastion"

info "Connecting to Jumpbox via SSH through Bastion $AZURE_BASTION_NAME in a background process"
$(az network bastion tunnel --name "$AZURE_BASTION_NAME" --resource-port 22 --port $LOCAL_BASTION_SSH_TUNNEL_PORT --target-resource-id "/subscriptions/$AZURE_SUBSCRIPTIONID/resourceGroups/$AZURE_RESOURCEGROUP/providers/Microsoft.Compute/virtualMachines/$AZURE_JUMPBOX_NAME") &

info "Sleeping to allow for Bastion tunnel to be established (ignore AZ ctrl+c warning)"
sleep 15

# Setting up SSH keys
##################################################
section "SSH Key Configuration"

if [ ! -f "$SSH_COMPLETE_FILE" ]; then
    if [ ! -f "$SSH_PRIVATE_KEY_PATH" ]; then
        info "Generating SSH keys"
        ssh-keygen -t rsa -b 4096 -C "$AZURE_JUMPBOX_USERNAME@$LOCAL_BASTION_SSH_TUNNEL_ADDRESS" -f $SSH_PRIVATE_KEY_PATH -N ""
    fi

    info "Removing known_hosts file in case the server changed"
    if [ -f "/home/node/.ssh/known_hosts" ]; then
        rm /home/node/.ssh/known_hosts
    fi

    info "Sending to Jumpbox"
    ssh-copy-id -p $LOCAL_BASTION_SSH_TUNNEL_PORT -i $SSH_PUBLIC_KEY_PATH $AZURE_JUMPBOX_USERNAME@127.0.0.1

    debug "Touch $SSH_COMPLETE_FILE to skip the process next run"
    touch $SSH_COMPLETE_FILE
else
    info "SSH keys have already been sent to Jumpbox; skipping."
fi

# Create tunnels to resources
##################################################
section "Creating Tunnels"

info "Creating local ports to Postgres server $AZURE_POSTGRES_SERVER and Redis server $AZURE_REDIS_SERVER"
$(ssh -o ExitOnForwardFailure=yes -4 -i $SSH_PRIVATE_KEY_PATH \
    -L $POSTGRESS_PORT:$AZURE_POSTGRES_SERVER:$POSTGRESS_PORT \
    -L $REDIS_PORT:$AZURE_REDIS_SERVER:$REDIS_PORT \
    -D 8080 -C \
    -N \
    $LOCAL_BASTION_SSH_TUNNEL_ADDRESS -p $LOCAL_BASTION_SSH_TUNNEL_PORT  -l $AZURE_JUMPBOX_USERNAME) &

info "Tunnels are now connected. Open a new terminal to use the connections."
warn "Press Ctrl+C in this terminal to close the tunnels and exit."
read -r -d '' _
