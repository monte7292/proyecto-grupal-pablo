module.exports = {
  host: "IP_LUBUNTU", // Cambiar por la IP real
  user: "guardias_user",
  password: "tu_contraseña_segura",
  database: "guardias",
  connectionLimit: 10,
  // Opciones adicionales para conexión remota
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};
