const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
    host:'localhost',
    user:'rootG',
    password:'root2025G',
    database:'guardias'
});

db.connect();

// ---------- PROFESORES ----------
app.get('/api/profesores',(req,res)=>{
    db.query('SELECT * FROM profesores ORDER BY apellidos',(e,r)=>res.json(r));
});

// ---------- GRUPOS ----------
app.get('/api/grupos',(req,res)=>{
    db.query('SELECT * FROM grupos ORDER BY nombre',(e,r)=>res.json(r));
});

// ---------- DISPONIBLES ----------
app.get('/api/profesores-disponibles',(req,res)=>{
    const {hora,fecha}=req.query;
    db.query(`
        SELECT * FROM profesores
        WHERE id NOT IN (
            SELECT profesor_id FROM reportes
            WHERE fecha=? AND hora_inicio<=? AND hora_fin>=?
        )
        AND id NOT IN (
            SELECT profesor_guardia_id FROM guardias
            WHERE fecha=? AND hora=?
        )
        ORDER BY apellidos
    `,[fecha,hora,hora,fecha,hora],(e,r)=>res.json(r));
});

// ---------- PANEL ----------
app.get('/api/panel',(req,res)=>{
    const {fecha}=req.query;
    db.query(`
        SELECT r.*,
               p.nombre nombre_profesor,p.apellidos apellidos_profesor,
               g.nombre grupo,
               pg.nombre nombre_guardia, pg.apellidos apellidos_guardia,
               ga.id guardia_id
        FROM reportes r
        JOIN profesores p ON r.profesor_id=p.id
        JOIN grupos g ON r.grupo_id=g.id
        LEFT JOIN guardias ga ON ga.reporte_id=r.id AND ga.fecha=r.fecha
        LEFT JOIN profesores pg ON ga.profesor_guardia_id=pg.id
        WHERE r.fecha=?
        ORDER BY r.hora_inicio
    `,[fecha],(e,r)=>res.json(r));
});

// ---------- AUSENCIAS ----------
app.post('/api/reportes',(req,res)=>{
    const {profesor_id,grupo_id,hora_inicio,hora_fin,tarea,fecha}=req.body;
    db.query(`
        INSERT INTO reportes
        (profesor_id,grupo_id,hora_inicio,hora_fin,tarea,fecha)
        VALUES (?,?,?,?,?,?)
    `,[profesor_id,grupo_id,hora_inicio,hora_fin,tarea,fecha]);
    res.json({ok:true});
});

app.delete('/api/reportes/:id',(req,res)=>{
    db.query('DELETE FROM reportes WHERE id=?',[req.params.id]);
    res.json({ok:true});
});

// ---------- GUARDIAS ----------
app.post('/api/guardias',(req,res)=>{
    const {reporte_id,profesor_guardia_id,hora,fecha}=req.body;
    db.query(`
        INSERT INTO guardias
        (reporte_id,profesor_guardia_id,hora,fecha)
        VALUES (?,?,?,?)
    `,[reporte_id,profesor_guardia_id,hora,fecha]);
    res.json({ok:true});
});

app.delete('/api/guardias/:id',(req,res)=>{
    db.query('DELETE FROM guardias WHERE id=?',[req.params.id]);
    res.json({ok:true});
});

app.listen(3000,()=>console.log('Servidor activo'));
