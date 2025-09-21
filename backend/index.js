// backend/index.js
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

//  db-credentials ligger i samma mapp som denna fil
import dbCredentials from './db-credentials.js';
//  media-rest-routes ligger i samma mapp som denna fil
import setupMediaRestRoutes from './media-rest-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// DB-anslutning (enkel connection – lärarstil)
const db = await mysql.createConnection(dbCredentials);

const app = express();
app.use(express.json());

// REST-rutter för bilder & PDF
setupMediaRestRoutes(app, db);

// Statiska mappar
// - Frontend ligger EN NIVÅ UPP från backend/
app.use(express.static(path.join(__dirname, '..', 'frontend')));
// - Media ligger i backend/
app.use('/images',    express.static(path.join(__dirname, 'images')));
app.use('/pdf-filer', express.static(path.join(__dirname, 'pdf-filer')));

// Starta server
const PORT = 5173; // byt till 5173 om din GMaps-nyckel kräver den porten
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});








