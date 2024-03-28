#!/usr/bin/env bash

# Populate local environment
##################################################
set -e

set -a

# Load environment file
source .env

# Variables for Tunnels
VM_JUMPHOST="127.0.0.1"
LOCAL_PORT=2022
POSTGRESS_PORT=5432
REDIS_PORT=6380
SSH_PRIVATE_KEY_PATH="$HOME/.ssh/$SSH_KEY_NAME"
SSH_PUBLIC_KEY_PATH="$SSH_PRIVATE_KEY_PATH.pub"

set +a

# Configure Azure CLI
##################################################
echo "Configuring AZ CLI"
if ! az account show &> /dev/null; then
    az login
fi

echo "Setting Azure subscription to $AZURE_SUBSCRIPTIONID"
az account set --subscription "$AZURE_SUBSCRIPTIONID"

echo "Setting default location to $AZURE_LOCATION and resource group to $AZURE_RESOURCEGROUP"
az configure --defaults location="$AZURE_LOCATION" group="$AZURE_RESOURCEGROUP"

echo "Installing AZ CLI Bastion extension"
az extension add --name bastion

# Connecting to Azure Bastion
##################################################
echo "Connecting to Jumpbox via SSH through Bastion $AZURE_BASTION_NAME in a background process"
$(az network bastion tunnel --name "$AZURE_BASTION_NAME" --resource-port 22 --port $LOCAL_PORT --target-resource-id "/subscriptions/$AZURE_SUBSCRIPTIONID/resourceGroups/$AZURE_RESOURCEGROUP/providers/Microsoft.Compute/virtualMachines/$AZURE_JUMPBOX_NAME") &

echo "Sleeping to allow for Bastion tunnel to be established (ignore AZ ctrl+c warning)"
sleep 15

# Setting up SSH keys
##################################################
if [ "$SKIP_KEY_GENERATION" = false ]; then
    echo "Generating SSH keys"
    ssh-keygen -t rsa -b 4096 -C "$JUMPBOX_USERNAME@$VM_JUMPHOST" -f $SSH_PRIVATE_KEY_PATH -N ""

    echo "Sending to Jumpbox"
    ssh-copy-id -p $LOCAL_PORT -i $SSH_PUBLIC_KEY_PATH $JUMPBOX_USERNAME@127.0.0.1
fi

# Create tunnels to resources
##################################################
echo "Creating local ports to Postgres server $POSTGRES_SERVER and Redis server $REDIS_SERVER"
$(ssh -o ExitOnForwardFailure=yes -4 -i $SSH_PRIVATE_KEY_PATH -p $LOCAL_PORT -L $POSTGRESS_PORT:$POSTGRES_SERVER:$POSTGRESS_PORT -L $REDIS_PORT:$REDIS_SERVER:$REDIS_PORT -N $VM_JUMPHOST -l $JUMPBOX_USERNAME) &

echo "Tunnels are now connected. Press Ctrl+C to close them and exit."
read -r -d '' _
