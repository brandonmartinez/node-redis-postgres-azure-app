#!/usr/bin/env bash

echo "Setting the Node version"
nvm install
nvm use

echo "Installing AZ CLI Bastion extension"
az extension add --name bastion

echo "Installing Node dependencies"
npm install