require('dotenv').config();
const express = require("express");
const mysql = require("mysql2/promise");
const { parse } = require("csv-parse/sync");
const { MongoClient } = require("mongodb");
const fs = require("fs");
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Configurar CORS para red local (más permisivo)
app.use(cors({
  origin: '*', // Permitir todos los orígenes temporalmente para debugging
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  credentials: false, // Deshabilitado temporalmente
  optionsSuccessStatus: 200
}));

// Middleware adicional para manejar preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

/* ================= MYSQL ================= */
// Configuración de MySQL (local o remoto)
const useRemoteMySQL = process.env.USE_REMOTE_MYSQL === 'true';
const credenciales = useRemoteMySQL ? 
  require('./credencialesSQL_remoto') : 
  require('./credencialesSQL');

const pool = mysql.createPool(credenciales);

// Log de configuración
console.log(`🗄️ MySQL: ${useRemoteMySQL ? 'REMOTO' : 'LOCAL'}`);
console.log(`📍 Host: ${credenciales.host}`);
console.log(`📊 Database: ${credenciales.database}`);

/* ================= MONGO ================= */
const mongoClient = new MongoClient(process.env.MONGO_URI);
let mongoDB = null;
mongoClient.connect().then(client => {
  mongoDB = client.db(); // DB por defecto
  console.log("Mongo conectado");
}).catch(err => console.error("Error Mongo:", err));

// VARIABLES GLOBALES
let cubrimientos = []; // Registro de cubrimientos en memoria

/* ================= FUNCIONES ================= */
function crearHorasVacias() {
  return {
    "1ª Hora": { hora: "1ª Hora", faltas: [], guardias: [] },
    "2ª Hora": { hora: "2ª Hora", faltas: [], guardias: [] },
    "3ª Hora": { hora: "3ª Hora", faltas: [], guardias: [] },
    "Recreo": { hora: "Recreo", faltas: [], guardias: [] },
    "4ª Hora": { hora: "4ª Hora", faltas: [], guardias: [] },
    "5ª Hora": { hora: "5ª Hora", faltas: [], guardias: [] },
    "6ª Hora": { hora: "6ª Hora", faltas: [], guardias: [] }
  };
}

function mapHora(valor) {
  if (!valor) return "1ª Hora";
  valor = valor.toString();
  
  // Manejar formatos específicos de la API MongoDB
  if (valor.includes("Recreo")) return "Recreo";
  if (valor.includes("1º") || valor.includes("1ª") || valor === "1") return "1ª Hora";
  if (valor.includes("2º") || valor.includes("2ª") || valor === "2") return "2ª Hora";
  if (valor.includes("3º") || valor.includes("3ª") || valor === "3") return "3ª Hora";
  if (valor.includes("4º") || valor.includes("4ª") || valor === "4") return "4ª Hora";
  if (valor.includes("5º") || valor.includes("5ª") || valor === "5") return "5ª Hora";
  if (valor.includes("6º") || valor.includes("6ª") || valor === "6") return "6ª Hora";
  
  // Manejar formatos de tiempo
  if (valor.includes("08:15")) return "1ª Hora";
  if (valor.includes("09:15")) return "2ª Hora";
  if (valor.includes("10:15")) return "3ª Hora";
  if (valor.includes("11:15")) return "4ª Hora";
  if (valor.includes("12:15")) return "5ª Hora";
  if (valor.includes("13:15")) return "6ª Hora";
  
  // Manejo por defecto
  if (valor.includes("1ª Hora")) return "1ª Hora";
  if (valor.includes("2ª Hora")) return "2ª Hora";
  if (valor.includes("3ª Hora")) return "3ª Hora";
  if (valor.includes("4ª Hora")) return "4ª Hora";
  if (valor.includes("5ª Hora")) return "5ª Hora";
  if (valor.includes("6ª Hora")) return "6ª Hora";
  
  return "1ª Hora";
}

function procesarCubrimientos(horas) {
  // Añadir cubrimientos a las ausencias correspondientes
  cubrimientos.forEach(cubrimiento => {
    const horaKey = cubrimiento.hora;
    if (horas[horaKey]) {
      // Buscar la ausencia correspondiente y marcarla como cubierta
      const ausencia = horas[horaKey].faltas.find(f => 
        f.profesor === cubrimiento.profesor_ausente
      );
      if (ausencia) {
        ausencia.cubierta = true;
        ausencia.cubierto_por = cubrimiento.profesor_guardia;
        ausencia.timestamp_cubrimiento = cubrimiento.timestamp;
      }
      
      // Mover el profesor de guardias de disponibles a ocupados
      const indexGuardia = horas[horaKey].guardias.indexOf(cubrimiento.profesor_guardia);
      if (indexGuardia > -1) {
        horas[horaKey].guardias.splice(indexGuardia, 1);
      }
    }
  });
  return horas;
}

/* ================= API MYSQL ================= */
app.get("/api/mysql", async (req, res) => {
  const inicio = Date.now();
  try {
    const [rows] = await pool.query(`
      SELECT r.hora_inicio, CONCAT(p.nombre,' ',p.apellidos) AS profesor_falta, g.nombre AS aula,
             CONCAT(pg.nombre,' ',pg.apellidos) AS profesor_guardia
      FROM reportes r
      JOIN profesores p ON r.profesor_id = p.id
      JOIN grupos g ON r.grupo_id = g.id
      LEFT JOIN guardias gu ON gu.reporte_id = r.id
      LEFT JOIN profesores pg ON gu.profesor_guardia_id = pg.id
    `);
    const horas = crearHorasVacias();
    rows.forEach(r => {
      const h = mapHora(r.hora_inicio);
      if (r.profesor_falta) horas[h].faltas.push({ profesor: r.profesor_falta, aula: r.aula });
      if (r.profesor_guardia) horas[h].guardias.push(r.profesor_guardia);
    });
    
    // Procesar cubrimientos
    procesarCubrimientos(horas);
    
    res.json({ tiempo: Date.now() - inicio, horas: Object.values(horas) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error MySQL" });
  }
});

/* ================= API CSV REMOTO ================= */
app.get("/api/csv", async (req, res) => {
  const inicio = Date.now();
  try {
    // Importación dinámica de node-fetch
    const { default: fetch } = await import('node-fetch');
    
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLBHYrwNyk20UoDwqBu-zfDXWSyeRtsg536axelI0eEHYsovoMiwgoS82tjGRy6Tysw3Pj6ovDiyzo/pub?gid=1908899796&single=true&output=csv";
    const response = await fetch(url);
    const csvText = await response.text();
    const registros = parse(csvText, { columns: true, skip_empty_lines: true });
    const horas = crearHorasVacias();
    registros.forEach(r => {
      const h = mapHora(r.Rango || r.Orden);
      if (!horas[h]) return;
      if ((r.Tipo || "").toUpperCase() === "AUSENCIA" || (r.Tipo || "").toUpperCase() === "FALTA") {
        horas[h].faltas.push({ profesor: r.Profesor, aula: r.Ubicacion || "-" });
      } else {
        horas[h].guardias.push(r.Profesor);
      }
    });
    
    // Procesar cubrimientos
    procesarCubrimientos(horas);
    
    res.json({ tiempo: Date.now() - inicio, horas: Object.values(horas) });
  } catch (err) {
    console.error("Error CSV remoto, usando archivo local:", err);
    try {
      // Fallback al archivo local
      const csvText = fs.readFileSync("guardia.csv", "utf-8");
      const registros = parse(csvText, { columns: true, skip_empty_lines: true });
      const horas = crearHorasVacias();
      registros.forEach(r => {
        const h = mapHora(r.Rango || r.Orden);
        if (!horas[h]) return;
        if ((r.Tipo || "").toUpperCase() === "AUSENCIA" || (r.Tipo || "").toUpperCase() === "FALTA") {
          horas[h].faltas.push({ profesor: r.Profesor, aula: r.Ubicacion || "-" });
        } else {
          horas[h].guardias.push(r.Profesor);
        }
      });
      
      // Procesar cubrimientos
      procesarCubrimientos(horas);
      
      res.json({ tiempo: Date.now() - inicio, horas: Object.values(horas) });
    } catch (fallbackErr) {
      console.error("Error también con archivo local:", fallbackErr);
      res.status(500).json({ error: "Error CSV remoto y local" });
    }
  }
});

/* ================= API JSON ================= */
app.get("/api/json", async (req, res) => {
  const inicio = Date.now();
  try {
    // Importación dinámica de node-fetch
    const { default: fetch } = await import('node-fetch');
    
    const url = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjA9OLWm9cVJjCZ9gI5Pe6Ys7g6F4Vi-aXp8N3H25MXSafryvkgs9HppD3kb5dzLJZRgpa0N_HFr1bOIxAeCog9chvMQk6npqXPR4VliZob7wmtWjdh0NvejSzit9NrGBSn3Yug9kUNi1Pc_O7Rx6Hn6RrTtQAxkVy8WfLnh78wDQgdjQdCGx_VfwU8kPaZaYgbxapTD0L0CsGpPB8U38ui96jA66-B4TyM3i03nSO-nBnfS4ipANseeqFEbL79l3dsx7BI63M6ScdmHVxZ1aT1V2EQUREq6WXyHrAt&lib=MJCz2_YYJYdZnZZA_De8hCYjMz4veuwP4";
    
    const response = await fetch(url);
    const data = await response.json();
    
    const horas = crearHorasVacias();
    (data.faltas || []).forEach(f => {
      const h = mapHora(f.hora);
      if (horas[h]) horas[h].faltas.push({ profesor: f.profesor, aula: f.aula || "-" });
    });
    (data.guardias || []).forEach(g => {
      const h = mapHora(g.hora);
      if (horas[h]) (g.profesores || []).forEach(p => horas[h].guardias.push(p));
    });
    
    // Procesar cubrimientos
    procesarCubrimientos(horas);
    
    res.json({ tiempo: Date.now() - inicio, horas: Object.values(horas) });
  } catch (err) {
    console.error("Error JSON remoto, usando archivo local:", err);
    try {
      // Fallback al archivo local
      const data = JSON.parse(fs.readFileSync("guardias.json", "utf-8"));
      const horas = crearHorasVacias();
      (data.faltas || []).forEach(f => {
        const h = mapHora(f.hora);
        if (horas[h]) horas[h].faltas.push({ profesor: f.profesor, aula: f.aula || "-" });
      });
      (data.guardias || []).forEach(g => {
        const h = mapHora(g.hora);
        if (horas[h]) (g.profesores || []).forEach(p => horas[h].guardias.push(p));
      });
      
      // Procesar cubrimientos
      procesarCubrimientos(horas);
      
      res.json({ tiempo: Date.now() - inicio, horas: Object.values(horas) });
    } catch (fallbackErr) {
      console.error("Error también con archivo local:", fallbackErr);
      res.status(500).json({ error: "Error JSON remoto y local" });
    }
  }
});

/* ================= API MONGO ================= */
app.get("/api/mongo", async (req, res) => {
  const inicio = Date.now();
  try {
    // Importación dinámica de node-fetch
    const { default: fetch } = await import('node-fetch');
    
    // Conexión mediante API REST local
    const mongoApiUrl = process.env.MONGO_API_URL || "http://172.22.0.138:3001";
    const fechaConsulta = req.query.fecha || new Date().toISOString().split('T')[0]; // Fecha del query o actual
    
    console.log("Intentando conectar a:", mongoApiUrl);
    console.log("Consultando fecha:", fechaConsulta);
    
    // Primero probar si la API está disponible
    try {
      const testResponse = await fetch(`${mongoApiUrl}/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("Test API status:", testResponse.status);
      if (testResponse.ok) {
        const testText = await testResponse.text();
        console.log("Test API response:", testText.substring(0, 200));
      }
    } catch (testErr) {
      console.log("Error en test API:", testErr.message);
    }
    
    // Probar diferentes endpoints posibles según la documentación
    const possibleEndpoints = [
      '/api/profesores',    // Para obtener profesores de guardia
      '/api/ausencias',     // Para obtener ausencias
      '/profesores',        // Versión sin /api
      '/ausencias',
      '/api/horarios',      // Información adicional
      '/api/aulas'          // Información adicional
    ];
    
    let ausenciasData = [];
    let guardiasData = [];
    
    // Buscar ausencias primero (según documentación: GET /ausencias)
    try {
      // Filtrar por fecha seleccionada
      console.log(`Buscando ausencias para la fecha: ${fechaConsulta}`);
      
      const ausenciasResponse = await fetch(`${mongoApiUrl}/api/ausencias`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (ausenciasResponse.ok) {
        const todasAusencias = await ausenciasResponse.json();
        console.log(`Total ausencias encontradas: ${todasAusencias.length}`);
        
        // Mostrar todas las fechas disponibles para depuración
        const fechasDisponibles = [...new Set(todasAusencias.map(a => a.fecha))];
        console.log('Fechas disponibles en la base de datos:', fechasDisponibles);
        
        // Filtrar por fecha seleccionada
        ausenciasData = todasAusencias.filter(ausencia => {
          const fechaAusencia = ausencia.fecha;
          const coincide = fechaAusencia === fechaConsulta;
          if (!coincide) {
            console.log(`Ausencia descartada - Fecha: ${fechaAusencia}, Esperada: ${fechaConsulta}`);
          }
          return coincide;
        });
        
        console.log(`Ausencias para ${fechaConsulta}: ${ausenciasData.length}`);
        
        // Mostrar detalles de las ausencias filtradas
        if (ausenciasData.length > 0) {
          console.log('Ausencias encontradas:');
          ausenciasData.forEach((ausencia, index) => {
            console.log(`  ${index + 1}. Profesor: ${ausencia.profesor?.nombre || 'N/A'} ${ausencia.profesor?.apellidos || ''}, Fecha: ${ausencia.fecha}, Hora: ${ausencia.hora}`);
          });
        }
        
        // Si no hay ausencias para esa fecha, intentar con /ausencias (sin /api)
        if (ausenciasData.length === 0) {
          console.log("No hay ausencias para esa fecha con /api/ausencias, intentando /ausencias");
          const altResponse = await fetch(`${mongoApiUrl}/ausencias`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          if (altResponse.ok) {
            const todasAusenciasAlt = await altResponse.json();
            ausenciasData = todasAusenciasAlt.filter(ausencia => {
              const fechaAusencia = ausencia.fecha;
              return fechaAusencia === fechaConsulta;
            });
            console.log(`Ausencias para ${fechaConsulta} con /ausencias: ${ausenciasData.length}`);
          }
        }
      } else {
        // Intentar con /ausencias (sin /api)
        const altResponse = await fetch(`${mongoApiUrl}/ausencias`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (altResponse.ok) {
          const todasAusencias = await altResponse.json();
          ausenciasData = todasAusencias.filter(ausencia => {
            const fechaAusencia = ausencia.fecha;
            return fechaAusencia === fechaConsulta;
          });
          console.log(`Ausencias para ${fechaConsulta} con /ausencias: ${ausenciasData.length}`);
        }
      }
    } catch (err) {
      console.log("❌ Error obteniendo ausencias:", err.message);
    }
    
    // Buscar profesores (para usar como guardias)
    try {
      const profesoresResponse = await fetch(`${mongoApiUrl}/api/profesores`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (profesoresResponse.ok) {
        guardiasData = await profesoresResponse.json();
        console.log(`✅ Profesores (guardias) encontrados en /api/profesores: ${guardiasData.length}`);
      } else {
        // Intentar con /profesores (sin /api)
        const altResponse = await fetch(`${mongoApiUrl}/profesores`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (altResponse.ok) {
          guardiasData = await altResponse.json();
          console.log(`✅ Profesores (guardias) encontrados en /profesores: ${guardiasData.length}`);
        }
      }
    } catch (err) {
      console.log("❌ Error obteniendo profesores:", err.message);
    }
    
    console.log("Datos finales - Ausencias:", ausenciasData.length, "Guardias:", guardiasData.length);
    
    const horas = crearHorasVacias();
    
    // Procesar ausencias desde la API (estructura según documentación)
    if (Array.isArray(ausenciasData) && ausenciasData.length > 0) {
      // Eliminar duplicados basados en profesor, fecha y hora
      const ausenciasUnicas = [];
      const seen = new Set();
      
      ausenciasData.forEach(doc => {
        const h = mapHora(doc.hora || doc.hora_inicio);
        if (horas[h]) {
          // Crear clave única para identificar duplicados
          const claveUnica = `${doc.profesor?.nombre || 'N/A'}_${doc.profesor?.apellidos || ''}_${doc.fecha}_${h}`;
          
          if (!seen.has(claveUnica)) {
            seen.add(claveUnica);
            
            // Manejar diferentes estructuras posibles del profesor
            let nombreProfesor = "Profesor desconocido";
            
            if (doc.profesor) {
              if (typeof doc.profesor === 'object') {
                // Si es objeto, combinar nombre y apellidos
                if (doc.profesor.nombre && doc.profesor.apellidos) {
                  nombreProfesor = `${doc.profesor.nombre} ${doc.profesor.apellidos}`;
                } else if (doc.profesor.nombre) {
                  nombreProfesor = doc.profesor.nombre;
                } else if (doc.profesor.apellidos) {
                  nombreProfesor = doc.profesor.apellidos;
                }
              } else if (typeof doc.profesor === 'string') {
                // Si es string, usar directamente
                nombreProfesor = doc.profesor;
              }
            } else if (doc.profesor_nombre) {
              nombreProfesor = doc.profesor_nombre;
              if (doc.profesor_apellidos) {
                nombreProfesor += ` ${doc.profesor_apellidos}`;
              }
            }
            
            ausenciasUnicas.push({
              ...doc,
              profesor: nombreProfesor,
              aula: doc.grupo || doc.aula || "-"
            });
            
            console.log(`Ausencia única: ${nombreProfesor} - ${doc.grupo || doc.aula || '-'} - Hora: ${h}`);
          } else {
            console.log(`Ausencia duplicada eliminada: ${doc.profesor?.nombre || 'N/A'} ${doc.profesor?.apellidos || ''} - Fecha: ${doc.fecha} - Hora: ${h}`);
          }
        }
      });
      
      // Usar las ausencias únicas
      ausenciasData = ausenciasUnicas;
      console.log(`Ausencias únicas para ${fechaConsulta}: ${ausenciasData.length}`);
      
      // Agregar las ausencias únicas a las horas
      ausenciasUnicas.forEach(doc => {
        const h = mapHora(doc.hora || doc.hora_inicio);
        console.log(`Mapeo de hora: "${doc.hora || doc.hora_inicio}" -> "${h}"`);
        if (horas[h]) {
          horas[h].faltas.push({ 
            profesor: doc.profesor,
            aula: doc.aula
          });
          console.log(`Ausencia agregada a ${h}: ${doc.profesor} - ${doc.aula}`);
        } else {
          console.log(`Hora no válida: ${h} para ausencia de ${doc.profesor}`);
        }
      });
    }
    
    // Procesar profesores como guardias desde la API
    if (Array.isArray(guardiasData) && guardiasData.length > 0) {
      guardiasData.forEach(doc => {
        // Todos los profesores están disponibles para guardias
        const nombreCompleto = doc.nombre + ' ' + doc.apellidos;
        
        // Agregar a todas las horas como disponibles, pero eliminar si están ausentes en esa hora
        Object.keys(horas).forEach(horaKey => {
          if (horaKey !== 'Recreo') { // No hay guardias en recreo
            // Verificar si este profesor está ausente en esta hora
            const estaAusente = horas[horaKey].faltas.some(falta => 
              falta.profesor === nombreCompleto
            );
            
            // Solo agregar como guardia si NO está ausente en esta hora
            if (!estaAusente) {
              horas[horaKey].guardias.push(nombreCompleto);
            } else {
              console.log(`Profesor ${nombreCompleto} eliminado de guardias en ${horaKey} (está ausente)`);
            }
          }
        });
      });
    }
    
    // Si no hay datos, añadir datos de ejemplo
    const tieneDatos = Object.values(horas).some(h => h.faltas.length > 0 || h.guardias.length > 0);
    if (!tieneDatos) {
      console.log("No se encontraron datos en la API local, añadiendo datos de ejemplo");
      horas["1ª Hora"].guardias.push("Juan Pérez", "Ana García");
      horas["1ª Hora"].faltas.push({ profesor: "Marta Sanchez", aula: "2º ESO A" });
      horas["2ª Hora"].guardias.push("Pedro T.", "Isabel R.");
      horas["2ª Hora"].faltas.push({ profesor: "Francisco J.", aula: "3º ESO C" });
    }
    
    // Procesar cubrimientos
    procesarCubrimientos(horas);
    
    res.json({ 
      tiempo: Date.now() - inicio, 
      horas: Object.values(horas),
      fuente: "MongoDB API Local",
      api_url: mongoApiUrl,
      ausencias_count: ausenciasData.length,
      guardias_count: guardiasData.length,
      fecha_consulta: fechaConsulta,
      endpoints_probados: possibleEndpoints,
      debug: {
        api_disponible: true,
        datos_encontrados: tieneDatos
      }
    });
  } catch (err) {
    console.error("Error MongoDB API Local:", err);
    // Fallback a datos de ejemplo si la API falla
    const horas = crearHorasVacias();
    horas["1ª Hora"].guardias.push("Juan Pérez", "Ana García");
    horas["1ª Hora"].faltas.push({ profesor: "Marta Sanchez", aula: "2º ESO A" });
    horas["2ª Hora"].guardias.push("Pedro T.", "Isabel R.");
    horas["2ª Hora"].faltas.push({ profesor: "Francisco J.", aula: "3º ESO C" });
    
    procesarCubrimientos(horas);
    
    res.json({ 
      tiempo: Date.now() - inicio, 
      horas: Object.values(horas),
      fuente: "MongoDB API Local (fallback)",
      error: "Error conectando con MongoDB API Local: " + err.message
    });
  }
});

/* ================= API PÚBLICA REST ================= */

// Obtener todas las ausencias
app.get("/api/v1/ausencias", async (req, res) => {
  try {
    const { fecha, profesor_id, grupo_id } = req.query;
    let query = `
      SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.tarea,
             CONCAT(p.nombre, ' ', p.apellidos) as profesor_nombre,
             p.id as profesor_id,
             g.nombre as grupo_nombre,
             g.id as grupo_id
      FROM reportes r
      JOIN profesores p ON r.profesor_id = p.id
      JOIN grupos g ON r.grupo_id = g.id
      WHERE 1=1
    `;
    
    const params = [];
    if (fecha) {
      query += " AND r.fecha = ?";
      params.push(fecha);
    }
    if (profesor_id) {
      query += " AND r.profesor_id = ?";
      params.push(profesor_id);
    }
    if (grupo_id) {
      query += " AND r.grupo_id = ?";
      params.push(grupo_id);
    }
    
    query += " ORDER BY r.fecha DESC, r.hora_inicio ASC";
    
    const [rows] = await pool.query(query, params);
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Error en /api/v1/ausencias:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener ausencias",
      message: error.message
    });
  }
});

// Obtener una ausencia específica
app.get("/api/v1/ausencias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.tarea,
             CONCAT(p.nombre, ' ', p.apellidos) as profesor_nombre,
             p.id as profesor_id,
             g.nombre as grupo_nombre,
             g.id as grupo_id
      FROM reportes r
      JOIN profesores p ON r.profesor_id = p.id
      JOIN grupos g ON r.grupo_id = g.id
      WHERE r.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Ausencia no encontrada"
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("Error en /api/v1/ausencias/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener ausencia",
      message: error.message
    });
  }
});

// Crear nueva ausencia
app.post("/api/v1/ausencias", async (req, res) => {
  try {
    const { profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha } = req.body;
    
    // Validaciones básicas
    if (!profesor_id || !grupo_id || !hora_inicio || !fecha) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios",
        required: ["profesor_id", "grupo_id", "hora_inicio", "fecha"]
      });
    }
    
    const [result] = await pool.query(`
      INSERT INTO reportes (profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [profesor_id, grupo_id, hora_inicio, hora_fin || null, tarea || "", fecha]);
    
    // Obtener la ausencia creada
    const [newAusencia] = await pool.query(`
      SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.tarea,
             CONCAT(p.nombre, ' ', p.apellidos) as profesor_nombre,
             p.id as profesor_id,
             g.nombre as grupo_nombre,
             g.id as grupo_id
      FROM reportes r
      JOIN profesores p ON r.profesor_id = p.id
      JOIN grupos g ON r.grupo_id = g.id
      WHERE r.id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      data: newAusencia[0],
      message: "Ausencia creada exitosamente"
    });
  } catch (error) {
    console.error("Error en POST /api/v1/ausencias:", error);
    res.status(500).json({
      success: false,
      error: "Error al crear ausencia",
      message: error.message
    });
  }
});

// Actualizar ausencia
app.put("/api/v1/ausencias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha } = req.body;
    
    // Verificar que la ausencia existe
    const [existing] = await pool.query("SELECT id FROM reportes WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Ausencia no encontrada"
      });
    }
    
    // Actualizar
    await pool.query(`
      UPDATE reportes 
      SET profesor_id = ?, grupo_id = ?, hora_inicio = ?, hora_fin = ?, tarea = ?, fecha = ?
      WHERE id = ?
    `, [profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha, id]);
    
    // Obtener datos actualizados
    const [updated] = await pool.query(`
      SELECT r.id, r.fecha, r.hora_inicio, r.hora_fin, r.tarea,
             CONCAT(p.nombre, ' ', p.apellidos) as profesor_nombre,
             p.id as profesor_id,
             g.nombre as grupo_nombre,
             g.id as grupo_id
      FROM reportes r
      JOIN profesores p ON r.profesor_id = p.id
      JOIN grupos g ON r.grupo_id = g.id
      WHERE r.id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: updated[0],
      message: "Ausencia actualizada exitosamente"
    });
  } catch (error) {
    console.error("Error en PUT /api/v1/ausencias/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error al actualizar ausencia",
      message: error.message
    });
  }
});

// Eliminar ausencia
app.delete("/api/v1/ausencias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la ausencia existe
    const [existing] = await pool.query("SELECT id FROM reportes WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Ausencia no encontrada"
      });
    }
    
    await pool.query("DELETE FROM reportes WHERE id = ?", [id]);
    
    res.json({
      success: true,
      message: "Ausencia eliminada exitosamente"
    });
  } catch (error) {
    console.error("Error en DELETE /api/v1/ausencias/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error al eliminar ausencia",
      message: error.message
    });
  }
});

// Obtener todos los profesores
app.get("/api/v1/profesores", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre, apellidos, CONCAT(nombre, ' ', apellidos) as nombre_completo
      FROM profesores
      ORDER BY nombre, apellidos
    `);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Error en /api/v1/profesores:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener profesores",
      message: error.message
    });
  }
});

// Obtener un profesor específico
app.get("/api/v1/profesores/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT id, nombre, apellidos, CONCAT(nombre, ' ', apellidos) as nombre_completo
      FROM profesores
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Profesor no encontrado"
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("Error en /api/v1/profesores/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener profesor",
      message: error.message
    });
  }
});

// Crear nuevo profesor
app.post("/api/v1/profesores", async (req, res) => {
  try {
    const { nombre, apellidos } = req.body;
    
    if (!nombre || !apellidos) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios",
        required: ["nombre", "apellidos"]
      });
    }
    
    const [result] = await pool.query(`
      INSERT INTO profesores (nombre, apellidos)
      VALUES (?, ?)
    `, [nombre, apellidos]);
    
    const [newProfesor] = await pool.query(`
      SELECT id, nombre, apellidos, CONCAT(nombre, ' ', apellidos) as nombre_completo
      FROM profesores
      WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      data: newProfesor[0],
      message: "Profesor creado exitosamente"
    });
  } catch (error) {
    console.error("Error en POST /api/v1/profesores:", error);
    res.status(500).json({
      success: false,
      error: "Error al crear profesor",
      message: error.message
    });
  }
});

// Obtener todos los grupos
app.get("/api/v1/grupos", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, nombre
      FROM grupos
      ORDER BY nombre
    `);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error("Error en /api/v1/grupos:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener grupos",
      message: error.message
    });
  }
});

// Obtener un grupo específico
app.get("/api/v1/grupos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT id, nombre
      FROM grupos
      WHERE id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Grupo no encontrado"
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("Error en /api/v1/grupos/:id:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener grupo",
      message: error.message
    });
  }
});

// Crear nuevo grupo
app.post("/api/v1/grupos", async (req, res) => {
  try {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios",
        required: ["nombre"]
      });
    }
    
    const [result] = await pool.query(`
      INSERT INTO grupos (nombre)
      VALUES (?)
    `, [nombre]);
    
    const [newGrupo] = await pool.query(`
      SELECT id, nombre
      FROM grupos
      WHERE id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      data: newGrupo[0],
      message: "Grupo creado exitosamente"
    });
  } catch (error) {
    console.error("Error en POST /api/v1/grupos:", error);
    res.status(500).json({
      success: false,
      error: "Error al crear grupo",
      message: error.message
    });
  }
});

// Endpoint de documentación de la API (JSON)
app.get("/api/v1/docs", (req, res) => {
  const docs = {
    title: "API REST de Gestión de Guardias y Ausencias",
    version: "1.0.0",
    description: "API pública para consultar y gestionar datos de ausencias, profesores y grupos",
    baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
    endpoints: {
      ausencias: {
        "GET /ausencias": "Obtener todas las ausencias (con filtros opcionales)",
        "GET /ausencias/:id": "Obtener una ausencia específica",
        "POST /ausencias": "Crear nueva ausencia",
        "PUT /ausencias/:id": "Actualizar ausencia existente",
        "DELETE /ausencias/:id": "Eliminar ausencia"
      },
      profesores: {
        "GET /profesores": "Obtener todos los profesores",
        "GET /profesores/:id": "Obtener un profesor específico",
        "POST /profesores": "Crear nuevo profesor"
      },
      grupos: {
        "GET /grupos": "Obtener todos los grupos",
        "GET /grupos/:id": "Obtener un grupo específico",
        "POST /grupos": "Crear nuevo grupo"
      },
      sistema: {
        "GET /docs": "Obtener documentación JSON",
        "GET /docs-html": "Obtener documentación HTML",
        "GET /health": "Verificar estado del sistema"
      }
    },
    examples: {
      obtenerAusencias: `${req.protocol}://${req.get('host')}/api/v1/ausencias?fecha=2026-02-12`,
      crearAusencia: {
        method: "POST",
        url: `${req.protocol}://${req.get('host')}/api/v1/ausencias`,
        body: {
          profesor_id: 1,
          grupo_id: 1,
          hora_inicio: 1,
          hora_fin: 2,
          tarea: "Revisar tema 4",
          fecha: "2026-02-12"
        }
      }
    }
  };
  
  res.json(docs);
});

// Endpoint de documentación HTML (servir el archivo Markdown)
app.get("/api/v1/docs-html", (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const docsPath = path.join(__dirname, 'API_DOCUMENTATION.md');
    const markdownContent = fs.readFileSync(docsPath, 'utf8');
    
    // Convertir Markdown a HTML básico
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API REST - Gestión de Guardias y Ausencias</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            color: #2c3e50;
            margin-top: 30px;
        }
        h1 {
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
        }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 15px 0;
        }
        pre code {
            background: none;
            padding: 0;
        }
        .endpoint {
            background: #e8f4fd;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 10px 0;
            border-radius: 0 5px 5px 0;
        }
        .method {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-weight: bold;
            color: white;
            font-size: 12px;
        }
        .get { background: #27ae60; }
        .post { background: #f39c12; }
        .put { background: #3498db; }
        .delete { background: #e74c3c; }
        .response {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            border: 1px solid #dee2e6;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
        }
        .nav {
            background: #34495e;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .nav a {
            color: white;
            text-decoration: none;
            margin-right: 20px;
            padding: 5px 10px;
            border-radius: 3px;
            transition: background 0.3s;
        }
        .nav a:hover {
            background: #2c3e50;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            background: #6c757d;
            color: white;
        }
        .required { background: #dc3545; }
        .optional { background: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="#ausencias">📋 Ausencias</a>
            <a href="#profesores">👥 Profesores</a>
            <a href="#grupos">🏫 Grupos</a>
            <a href="#sistema">🔧 Sistema</a>
            <a href="#ejemplos">💡 Ejemplos</a>
        </div>
        
        <div class="markdown-content">
            ${markdownContent
              .replace(/^# (.+)$/gm, '<h1 id="$1">$1</h1>')
              .replace(/^## (.+)$/gm, '<h2 id="$1">$1</h2>')
              .replace(/^### (.+)$/gm, '<h3 id="$1">$1</h3>')
              .replace(/`([^`]+)`/g, '<code>$1</code>')
              .replace(/```bash\n([\s\S]*?)```/g, '<pre><code class="bash">$1</code></pre>')
              .replace(/```json\n([\s\S]*?)```/g, '<pre><code class="json">$1</code></pre>')
              .replace(/```javascript\n([\s\S]*?)```/g, '<pre><code class="javascript">$1</code></pre>')
              .replace(/```python\n([\s\S]*?)```/g, '<pre><code class="python">$1</code></pre>')
              .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
              .replace(/^\* (.+)$/gm, '<li>$1</li>')
              .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
              .replace(/^\| (.+) \|$/gm, (match, content) => {
                const cells = content.split(' | ');
                return '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
              })
              .replace(/^- (.+)$/gm, '<li>$1</li>')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
              .replace(/GET \/(.+)/g, '<span class="method get">GET</span> <code>/$1</code>')
              .replace(/POST \/(.+)/g, '<span class="method post">POST</span> <code>/$1</code>')
              .replace(/PUT \/(.+)/g, '<span class="method put">PUT</span> <code>/$1</code>')
              .replace(/DELETE \/(.+)/g, '<span class="method delete">DELETE</span> <code>/$1</code>')
              .replace(/Obligatorio/g, '<span class="badge required">Obligatorio</span>')
              .replace(/Opcional/g, '<span class="badge optional">Opcional</span>')
            }
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d;">
            <p><strong>API REST v1.0.0</strong> | Gestión de Guardias y Ausencias</p>
            <p>Base URL: <code>${req.protocol}://${req.get('host')}/api/v1</code></p>
            <p>Generado el: ${new Date().toLocaleString('es-ES')}</p>
        </div>
    </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error cargando documentación:', error);
    res.status(500).json({
      success: false,
      error: "Error al cargar documentación",
      message: error.message
    });
  }
});

// Endpoint de documentación Markdown (texto plano)
app.get("/api/v1/docs-md", (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const docsPath = path.join(__dirname, 'API_DOCUMENTATION.md');
    const markdownContent = fs.readFileSync(docsPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(markdownContent);
  } catch (error) {
    console.error('Error cargando documentación:', error);
    res.status(500).json({
      success: false,
      error: "Error al cargar documentación",
      message: error.message
    });
  }
});

// Endpoint de salud/check
app.get("/api/v1/health", async (req, res) => {
  try {
    // Verificar conexión a MySQL
    await pool.query("SELECT 1");
    
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: "1.0.0"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message
    });
  }
});

/* ================= AUSENCIAS MYSQL ================= */
app.post("/api/reportes", async (req,res) => {
  const { profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha } = req.body;
  try {
    await pool.query(
      `INSERT INTO reportes (profesor_id,grupo_id,hora_inicio,hora_fin,tarea,fecha) VALUES (?,?,?,?,?,?)`,
      [profesor_id, grupo_id, hora_inicio, hora_fin, tarea, fecha]
    );
    res.json({ ok:true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error:"Error insert reportes"});
  }
});

/* ================= CUBRIR AUSENCIA ================= */
app.post("/api/cubrir-ausencia", async (req, res) => {
  const { profesor_guardia, profesor_ausente, hora, fecha } = req.body;
  const inicio = Date.now();
  try {
    // Guardar el cubrimiento en memoria
    const cubrimiento = {
      profesor_guardia,
      profesor_ausente,
      hora: mapHora(hora),
      fecha,
      timestamp: new Date().toISOString()
    };
    
    cubrimientos.push(cubrimiento);
    console.log(`Cubrimiento registrado: ${profesor_guardia} cubre a ${profesor_ausente} en hora ${cubrimiento.hora}`);
    
    res.json({ 
      ok: true, 
      mensaje: `${profesor_guardia} cubre a ${profesor_ausente} en hora ${hora}`,
      cubrimiento,
      tiempo: Date.now() - inicio
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Error al cubrir ausencia" });
  }
});

/* ================= OBTENER PROFESORES ================= */
app.get("/api/profesores", async (req, res) => {
  const inicio = Date.now();
  try {
    const [rows] = await pool.query("SELECT id, CONCAT(nombre,' ',apellidos) as nombre FROM profesores ORDER BY nombre");
    res.json({ tiempo: Date.now() - inicio, profesores: rows });
  } catch(err) {
    // Si MySQL falla, devolver datos de ejemplo
    const profesoresEjemplo = [
      { id: 1, nombre: "Juan Pérez" },
      { id: 2, nombre: "Ana García" },
      { id: 3, nombre: "Pedro T." },
      { id: 4, nombre: "Isabel R." },
      { id: 5, nombre: "Diego L." },
      { id: 6, nombre: "Mercedes S." },
      { id: 7, nombre: "Antonio M." },
      { id: 8, nombre: "Rosa T." }
    ];
    res.json({ tiempo: Date.now() - inicio, profesores: profesoresEjemplo });
  }
});

/* ================= OBTENER GRUPOS ================= */
app.get("/api/grupos", async (req, res) => {
  const inicio = Date.now();
  try {
    const [rows] = await pool.query("SELECT id, nombre FROM grupos ORDER BY nombre");
    res.json({ tiempo: Date.now() - inicio, grupos: rows });
  } catch(err) {
    // Si MySQL falla, devolver datos de ejemplo
    const gruposEjemplo = [
      { id: 1, nombre: "1º ESO A" },
      { id: 2, nombre: "1º ESO B" },
      { id: 3, nombre: "2º ESO A" },
      { id: 4, nombre: "2º ESO B" },
      { id: 5, nombre: "3º ESO A" },
      { id: 6, nombre: "3º ESO B" },
      { id: 7, nombre: "4º ESO A" },
      { id: 8, nombre: "4º ESO B" },
      { id: 9, nombre: "1º Bachillerato" },
      { id: 10, nombre: "2º Bachillerato" }
    ];
    res.json({ tiempo: Date.now() - inicio, grupos: gruposEjemplo });
  }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Servidor activo en http://localhost:${PORT}`));
