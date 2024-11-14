#!/bin/bash

cd frontend
npm install
npm run build

sudo cp -r dist/* /var/www/meshshare/

sudo chown -R www-data:www-data /var/www/meshshare
sudo chmod -R 755 /var/www/meshshare

cd ../backend
npm install

pm2 restart meshshare-backend

echo "Deployment complete!"
