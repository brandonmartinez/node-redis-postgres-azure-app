#!/usr/bin/env bash

# Populate local environment
##################################################
set -a

# Load environment file
source .env

# Variables for Tunnels
VM_JUMPHOST="127.0.0.1"
LOCAL_PORT=2022
POSTGRESS_PORT=5432

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

echo "Sleeping to allow for Bastion tunnel to be established"
sleep 15

# Create Port
##################################################
echo "Creating local port to Postgres server $POSTGRES_SERVER"
ssh -p $LOCAL_PORT -L $POSTGRESS_PORT:$POSTGRES_SERVER:$POSTGRESS_PORT -l $JUMPBOX_USERNAME -N $VM_JUMPHOST