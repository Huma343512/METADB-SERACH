import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import exifr from 'exifr';
import mysql from 'mysql2/promise';
import dbCreds from './db-credentials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const IMAGES_DIR = path.join(__dirname, 'images');

const db = await mysql.createConnection(dbCreds);

// enkel mimetype
const mime = ext => (
  ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
  ext === '.png' ? 'image/png' :
  'image/*'
);

// hämta alla jpg/png
const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpe?g|png)$/i.test(f));
console.log(`Hittade ${files.length} bilder`);

let ok = 0, skip = 0, fail = 0;

for (const file of files) {
  const full = path.join(IMAGES_DIR, file);

  try {
    // basmetadata (alltid)
    const st  = fs.statSync(full);
    const ext = path.extname(file).toLowerCase();
    const base = {
      fileName: file,
      fileSize: st.size,
      fileExt:  ext,
      mimeType: mime(ext),
      createdFs: st.birthtime?.toISOString?.() ?? null,
      modifiedFs: st.mtime?.toISOString?.() ?? null,
    };

    // exif (bara jpg/jpeg)
    let exif = null;
    if (ext === '.jpg' || ext === '.jpeg') {
      try { exif = await exifr.parse(full) || null; }
      catch { /* hoppa över EXIF-fel */ }
    }

    const meta = JSON.stringify({ ...base, ...(exif || {}) });

    //  lägg bara in NYA bilder
    const [result] = await db.execute(
      `INSERT IGNORE INTO imageMetadata (fileName, metaData)
       VALUES (?, ?)`,
      [file, meta]
    );

    if (result.affectedRows === 0) {
      console.log('Hoppar över (finns redan):', file);
      skip++;
    } else {
      console.log('OK:', file);
      ok++;
    }
  } catch (e) {
    console.warn('Fel:', file, '-', e.message);
    fail++;
  }
}

await db.end();
console.log(`Klar. OK: ${ok}, Hoppar över: ${skip}, Fel: ${fail}`);

