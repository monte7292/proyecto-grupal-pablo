#!/bin/bash

# Script para instalar Node.js y dependencias de la API
# Ejecutar: sudo bash install_node_api.sh

echo "🚀 Instalando Node.js y dependencias para API de Guardias..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js (última versión LTS)
echo "📥 Instalando Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
echo "✅ Verificando Node.js..."
node --version
npm --version

# Instalar dependencias globales
echo "📦 Instalando PM2 (process manager)..."
sudo npm install -g pm2

# Crear directorio para la API
echo "📁 Creando directorio..."
mkdir -p /home/$USER/api-guardias

# Ir al directorio
cd /home/$USER/api-guardias

echo "🎉 Instalación de Node.js completada!"
echo "📋 Siguientes pasos:"
echo "   1. Transfiere los archivos del proyecto"
echo "   2. Ejecuta 'npm install'"
echo "   3. Configura .env"
echo "   4. Inicia con 'pm2 start server.js'"
echo ""
echo "📍 Directorio: /home/$USER/api-guardias"
