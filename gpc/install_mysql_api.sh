#!/bin/bash

# Script de instalación de MySQL para API de Guardias
# Ejecutar en Lubuntu: sudo bash install_mysql_api.sh

echo "🚀 Instalando MySQL para API de Guardias..."

# Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar MySQL
echo "🗄️ Instalando MySQL Server..."
sudo apt install mysql-server mysql-client net-tools -y

# Iniciar y habilitar MySQL
echo "🔄 Iniciando MySQL..."
sudo systemctl start mysql
sudo systemctl enable mysql

# Seguridad
echo "🔒 Configurando seguridad..."
sudo mysql_secure_installation

# Configurar para acceso remoto
echo "🌐 Configurando acceso remoto..."
sudo cp /etc/mysql/mysql.conf.d/mysqld.cnf /etc/mysql/mysql.conf.d/mysqld.cnf.backup

# Modificar configuración
sudo sed -i 's/bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo sed -i 's/#skip-networking/skip-networking = OFF/' /etc/mysql/mysql.conf.d/mysqld.cnf

# Crear base de datos y usuario
echo "👥 Creando base de datos y usuario..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS guardias;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'guardias_user'@'%' IDENTIFIED BY 'Guardias2025!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON guardias.* TO 'guardias_user'@'%';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Configurar firewall
echo "🔥 Configurando firewall..."
sudo ufw allow 3306/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

# Reiniciar MySQL
echo "🔄 Reiniciando MySQL..."
sudo systemctl restart mysql

# Obtener IP
echo "📍 Información de red:"
echo "IP Local: $(hostname -I | awk '{print $1}')"
echo "Puerto MySQL: 3306"

# Verificar estado
echo "✅ Verificando instalación..."
sudo systemctl status mysql --no-pager

echo "🎉 Instalación completada!"
echo "📋 Datos de conexión:"
echo "   Host: $(hostname -I | awk '{print $1}')"
echo "   Puerto: 3306"
echo "   Usuario: guardias_user"
echo "   Password: Guardias2025!"
echo "   Database: guardias"
echo ""
echo "🔧 Para conectar desde tu aplicación Windows:"
echo "   1. Actualiza credencialesSQL_remoto.js con la IP mostrada"
echo "   2. Cambia USE_REMOTE_MYSQL=true en .env"
echo "   3. Reinicia tu aplicación"
