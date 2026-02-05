DROP DATABASE IF EXISTS guardias;
CREATE DATABASE guardias;
USE guardias;

CREATE TABLE profesores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50),
    apellidos VARCHAR(100)
);

CREATE TABLE grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(20)
);

CREATE TABLE reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT,
    grupo_id INT,
    hora_inicio INT,
    hora_fin INT,
    tarea TEXT,
    fecha DATE,
    FOREIGN KEY (profesor_id) REFERENCES profesores(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES grupos(id)
);

CREATE TABLE guardias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporte_id INT,
    profesor_guardia_id INT,
    hora INT,
    fecha DATE,
    FOREIGN KEY (reporte_id) REFERENCES reportes(id) ON DELETE CASCADE,
    FOREIGN KEY (profesor_guardia_id) REFERENCES profesores(id)
);

-- PROFESORES
INSERT INTO profesores (nombre,apellidos) VALUES
('María','Fernández Ruiz'),
('Laura','Pérez Gómez'),
('Juan','López García'),
('Ana','Martín Díaz'),
('Carlos','Sánchez Mora'),
('Lucía','Navarro Gil'),
('Pedro','Romero Torres'),
('Elena','Vega Castillo');

-- GRUPOS
INSERT INTO grupos (nombre) VALUES
('1ºA'),('1ºB'),('2ºA'),('2ºB'),
('3ºA'),('3ºB'),('4ºA'),('4ºB');

-- EJEMPLOS DE AUSENCIAS
INSERT INTO reportes VALUES
(NULL,1,1,1,2,'Trabajo en Moodle',CURDATE()),
(NULL,2,4,3,3,'Ejercicios página 45',CURDATE());
