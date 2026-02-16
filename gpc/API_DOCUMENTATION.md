# 📚 API REST de Gestión de Guardias y Ausencias

## 🌐 Información General

- **Base URL:** `http://localhost:3000/api/v1`
- **Versión:** 1.0.0
- **Formato:** JSON
- **Métodos:** GET, POST, PUT, DELETE

## 🔍 Endpoints Disponibles

### 📋 **Ausencias**

#### `GET /api/v1/ausencias`
Obtener todas las ausencias con filtros opcionales.

**Parámetros Query:**
- `fecha` (string, opcional): Filtrar por fecha (YYYY-MM-DD)
- `profesor_id` (number, opcional): Filtrar por ID de profesor
- `grupo_id` (number, opcional): Filtrar por ID de grupo

**Ejemplo:**
```bash
GET /api/v1/ausencias?fecha=2026-02-12&profesor_id=1
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "fecha": "2026-02-12",
      "hora_inicio": 1,
      "hora_fin": 2,
      "tarea": "Revisar tema 4",
      "profesor_nombre": "Juan Pérez",
      "profesor_id": 1,
      "grupo_nombre": "2º ESO A",
      "grupo_id": 1
    }
  ],
  "count": 1
}
```

---

#### `GET /api/v1/ausencias/:id`
Obtener una ausencia específica por ID.

**Parámetros Path:**
- `id` (number): ID de la ausencia

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fecha": "2026-02-12",
    "hora_inicio": 1,
    "hora_fin": 2,
    "tarea": "Revisar tema 4",
    "profesor_nombre": "Juan Pérez",
    "profesor_id": 1,
    "grupo_nombre": "2º ESO A",
    "grupo_id": 1
  }
}
```

---

#### `POST /api/v1/ausencias`
Crear una nueva ausencia.

**Body:**
```json
{
  "profesor_id": 1,
  "grupo_id": 1,
  "hora_inicio": 1,
  "hora_fin": 2,
  "tarea": "Revisar tema 4",
  "fecha": "2026-02-12"
}
```

**Campos Obligatorios:**
- `profesor_id` (number)
- `grupo_id` (number)
- `hora_inicio` (number)
- `fecha` (string, YYYY-MM-DD)

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "fecha": "2026-02-12",
    "hora_inicio": 1,
    "hora_fin": 2,
    "tarea": "Revisar tema 4",
    "profesor_nombre": "Juan Pérez",
    "profesor_id": 1,
    "grupo_nombre": "2º ESO A",
    "grupo_id": 1
  },
  "message": "Ausencia creada exitosamente"
}
```

---

#### `PUT /api/v1/ausencias/:id`
Actualizar una ausencia existente.

**Body:** Mismo formato que POST

**Respuesta:**
```json
{
  "success": true,
  "data": { /* datos actualizados */ },
  "message": "Ausencia actualizada exitosamente"
}
```

---

#### `DELETE /api/v1/ausencias/:id`
Eliminar una ausencia.

**Respuesta:**
```json
{
  "success": true,
  "message": "Ausencia eliminada exitosamente"
}
```

---

### 👥 **Profesores**

#### `GET /api/v1/profesores`
Obtener todos los profesores.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Juan",
      "apellidos": "Pérez",
      "nombre_completo": "Juan Pérez"
    }
  ],
  "count": 1
}
```

---

#### `GET /api/v1/profesores/:id`
Obtener un profesor específico.

---

#### `POST /api/v1/profesores`
Crear un nuevo profesor.

**Body:**
```json
{
  "nombre": "Ana",
  "apellidos": "García"
}
```

---

### 🏫 **Grupos**

#### `GET /api/v1/grupos`
Obtener todos los grupos.

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "2º ESO A"
    }
  ],
  "count": 1
}
```

---

#### `GET /api/v1/grupos/:id`
Obtener un grupo específico.

---

#### `POST /api/v1/grupos`
Crear un nuevo grupo.

**Body:**
```json
{
  "nombre": "3º ESO B"
}
```

---

## 🔧 **Endpoints de Sistema**

### 📖 `GET /api/v1/docs`
Obtener documentación completa de la API.

### 💓 `GET /api/v1/health`
Verificar estado del sistema y conexión a base de datos.

**Respuesta:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-02-12T18:00:00.000Z",
  "database": "connected",
  "version": "1.0.0"
}
```

---

## 🚨 **Códigos de Error**

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Parámetros inválidos |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

**Formato de error:**
```json
{
  "success": false,
  "error": "Descripción del error",
  "message": "Mensaje detallado"
}
```

---

## 💡 **Ejemplos de Uso**

### **JavaScript/Fetch**
```javascript
// Obtener ausencias de hoy
const response = await fetch('/api/v1/ausencias?fecha=2026-02-12');
const data = await response.json();

// Crear nueva ausencia
const nuevaAusencia = await fetch('/api/v1/ausencias', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profesor_id: 1,
    grupo_id: 1,
    hora_inicio: 1,
    fecha: '2026-02-12'
  })
});
```

### **cURL**
```bash
# Obtener todas las ausencias
curl -X GET "http://localhost:3000/api/v1/ausencias"

# Crear nueva ausencia
curl -X POST "http://localhost:3000/api/v1/ausencias" \
  -H "Content-Type: application/json" \
  -d '{
    "profesor_id": 1,
    "grupo_id": 1,
    "hora_inicio": 1,
    "fecha": "2026-02-12"
  }'
```

### **Python/Requests**
```python
import requests

# Obtener ausencias
response = requests.get('http://localhost:3000/api/v1/ausencias')
data = response.json()

# Crear ausencia
nueva_ausencia = requests.post('http://localhost:3000/api/v1/ausencias', json={
    'profesor_id': 1,
    'grupo_id': 1,
    'hora_inicio': 1,
    'fecha': '2026-02-12'
})
```

---

## 🔒 **Consideraciones de Seguridad**

- La API actualmente no implementa autenticación
- En producción, considera añadir API Keys o JWT
- Valida siempre los datos de entrada
- Implementa rate limiting para prevenir abusos

---

## 📞 **Soporte**

Para cualquier duda o problema, contacta con el administrador del sistema.
