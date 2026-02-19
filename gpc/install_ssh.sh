#!/bin/bash

# Script para instalar y configurar SSH en Lubuntu
# Ejecutar: sudo bash install_ssh.sh

echo "🔧 Instalando y configurando SSH..."

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar OpenSSH Server
echo "📥 Instalando OpenSSH Server..."
sudo apt install openssh-server -y

# Iniciar servicio SSH
echo "🔄 Iniciando servicio SSH..."
sudo systemctl start ssh
sudo systemctl enable ssh

# Configurar firewall para SSH
echo "🔥 Configurando firewall..."
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Verificar estado
echo "✅ Verificando estado del servicio SSH..."
sudo systemctl status ssh --no-pager

# Verificar puerto
echo "🔍 Verificando puerto SSH..."
sudo netstat -an | grep :22

# Mostrar configuración
echo "📋 Información de conexión SSH:"
echo "   Usuario: $(whoami)"
echo "   Host: $(hostname -I | awk '{print $1}')"
echo "   Puerto: 22"
echo ""
echo "🔧 Para conectar desde Windows:"
echo "   scp archivo usuario@$(hostname -I | awk '{print $1}'):/ruta/"
echo "   ssh usuario@$(hostname -I | awk '{print $1}')"

echo "🎉 SSH configurado exitosamente!"
