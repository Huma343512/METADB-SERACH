// backend/import-pdfs.js
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse-fork';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import db from './db-credentials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ← HÄR LIGGER DINA PDF:er
const PDF_DIR = path.join(__dirname, 'pdf-filer');

// Debug: visa var vi letar
console.log('Söker PDF i:', PDF_DIR);

// Kolla att mappen finns och lista filer
if (!fs.existsSync(PDF_DIR)) {
  console.error('Mappen finns inte:', PDF_DIR);
  process.exit(1);
}
const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
console.log('Hittade', files.length, 'PDF-filer:', files);

// Koppla mot DB
const conn = await mysql.createConnection(db);

// Skapa tabell om den saknas
await conn.execute(`
  CREATE TABLE IF NOT EXISTS pdfMeta (
    id INT NOT NULL AUTO_INCREMENT,
    fileName VARCHAR(255) NOT NULL,
    metaData JSON,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_fileName (fileName)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

for (const file of files) {
  try {
    const buf = fs.readFileSync(path.join(PDF_DIR, file));
    const parsed = await pdfParse(buf);
    const info = parsed.info || {};

    // Plocka ut det viktigaste; lagra som JSON
    const payload = {
      title: info.Title || null,
      author: info.Author || null,
      subject: info.Subject || null,
      keywords: info.Keywords || null,
      creator: info.Creator || null,
      producer: info.Producer || null,
      creationDate: info.CreationDate || null, // rå PDF-datumsträng
      modDate: info.ModDate || null,
      numPages: parsed.numpages ?? null
    };

    await conn.execute(
      `INSERT INTO pdfMeta (fileName, metaData)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE metaData = VALUES(metaData)`,
      [file, JSON.stringify(payload)]
    );
    console.log('OK:', file);
  } catch (e) {
    console.log('FEL:', file, e.message);
  }
}

await conn.end();
console.log('Klart.');

