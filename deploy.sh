# Create deploy script
cat > ~/MeshShare/deploy.sh << 'EOF'
#!/bin/bash
# Build the project
npm run build:prod

# Copy to web directory
sudo cp -r dist/* /var/www/meshshare/

# Fix permissions
sudo chown -R www-data:www-data /var/www/meshshare
sudo chmod -R 755 /var/www/meshshare

# Reload nginx (optional, only if needed)
# sudo systemctl reload nginx

echo "Deployment complete!"
EOF
