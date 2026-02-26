module.exports = {
  host: "172.22.0.205", // IP de la máquina virtual con MySQL
  user: "rootG",
  password: "root2025G",
  database: "guardias",
  connectionLimit: 10,
  // Opciones adicionales para conexión remota
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};
