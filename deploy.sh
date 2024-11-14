# Create deploy script
cat > ~/FileShare/deploy.sh << 'EOF'
#!/bin/bash

# Deploy frontend
cd frontend
npm install
npm run build

# Copy frontend to web directory
sudo cp -r dist/* /var/www/meshshare/

# Fix frontend permissions
sudo chown -R www-data:www-data /var/www/meshshare
sudo chmod -R 755 /var/www/meshshare

# Deploy backend
cd ../backend
npm install

# Restart backend service (assuming you're using PM2 or similar)
pm2 restart meshshare-backend

echo "Deployment complete!"
EOF
