const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors()); // Permite peticiones desde tu HTML
app.use(express.json()); // Permite recibir JSON

// --- CONFIGURACIÓN DE LA BASE DE DATOS ---
const db = mysql.createConnection({
    host: 'localhost',      // O la IP de tu servidor MySQL
    user: 'rootG',           // Tu usuario de MySQL
    password: 'root2025G',// Tu contraseña de MySQL
    database: 'guardias'  // El nombre de tu base de datos
});

// Conectar a MySQL
db.connect(err => {
    if (err) {
        console.error('Error conectando a la BD:', err);
        return;
    }
    console.log('¡Conectado a MySQL exitosamente!');
});

// --- TUS RUTAS (ENDPOINTS) ---

// Esta es la ruta que sustituirá a jsonplaceholder
app.get('/api/profesores', (req, res) => {
    // Aquí escribes SQL puro
    const sql = 'SELECT * FROM profesores'; 
    
    db.query(sql, (err, results) => {
        if (err) {
            // Si falla la BD, avisamos al frontend
            return res.status(500).json({ error: err.message }); 
        }
        // Si sale bien, enviamos los datos en formato JSON
        res.json(results); 
    });
});
// NUEVA RUTA: Para guardar una guardia/ausencia (Método POST)
app.post('/api/reportes', (req, res) => {
    // Recibimos los datos que envía el frontend
    const { profesor_id, hora, tarea, es_ausencia } = req.body;

    const sql = `INSERT INTO reportes_guardias (profesor_id, hora, tarea, es_ausencia) VALUES (?, ?, ?, ?)`;

    // Usamos ? para evitar inyecciones SQL (seguridad básica)
    db.query(sql, [profesor_id, hora, tarea, es_ausencia], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al guardar en BD' });
        }
        res.json({ mensaje: 'Guardia registrada correctamente', id: result.insertId });
    });
});

// Arrancar el servidor en el puerto 3000
app.listen(3000, () => {
    console.log('Tu API está corriendo en http://localhost:3000');
});