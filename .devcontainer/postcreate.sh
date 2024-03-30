#!/usr/bin/env bash

echo "Installing AZ CLI Bastion extension"
az extension add --name bastion

cd app

echo "Setting the Node version"
nvm install
nvm use

echo "Installing Node dependencies"
npm install