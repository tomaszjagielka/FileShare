#!/bin/bash

# Navigate to frontend directory and install dependencies
cd frontend
npm install

# Build the frontend application using Vite
npm run build

# Create the target directory if it doesn't exist
sudo mkdir -p /var/www/fileshare

# Copy the built files to the web server directory
sudo cp -r dist/* /var/www/fileshare/

# Set proper ownership and permissions
sudo chown -R www-data:www-data /var/www/fileshare
sudo chmod -R 755 /var/www/fileshare

# Navigate to backend directory and install dependencies
cd ../backend
npm install

# Restart the backend service
pm2 restart fileshare-backend

echo "Deployment complete!"
