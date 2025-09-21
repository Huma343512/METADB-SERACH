// backend/media-rest-routes.js
export default function setupMediaRestRoutes(app, db) {

  // BILDER 

  // sök bilder på olika fält
  app.get('/api/image-search/:field/:value', async (req, res) => {
    const { field, value } = req.params;
    const gpsOnly = req.query.gps === '1';

    const allowed = ['filename','artist','created','modified','ISO'];
    if (!allowed.includes(field)) {
      return res.json([]);
    }

    // välj rätt fält i databasen
    let where = 'fileName';
    if (field === 'artist')   where = "metaData->>'$.Artist'";
    if (field === 'created')  where = "metaData->>'$.CreateDate'";
    if (field === 'modified') where = "metaData->>'$.ModifyDate'";
    if (field === 'ISO')      where = "metaData->>'$.ISO'";

    const gpsWhere = gpsOnly
      ? " AND metaData->>'$.latitude' IS NOT NULL AND metaData->>'$.longitude' IS NOT NULL"
      : "";

    try {
      const [rows] = await db.execute(`
        SELECT id,
               fileName,
               metaData->>'$.Artist'       AS artist,
               metaData->>'$.CreateDate'   AS created,
               metaData->>'$.ModifyDate'   AS modified,
               metaData->>'$.ISO'          AS ISO,
               metaData->>'$.latitude'     AS latitude,
               metaData->>'$.longitude'    AS longitude
        FROM imageMetadata
        WHERE LOWER(${where}) LIKE LOWER(?)
        ${gpsWhere}
        ORDER BY id DESC
      `, ['%' + value + '%']);

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });

  // hämta all metadata för en bild
  app.get('/api/image-all-meta/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await db.execute(
        `SELECT * FROM imageMetadata WHERE id = ?`, [id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });

  // lista alla bilder med gps
  app.get('/api/images', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT id, fileName,
               metaData->>'$.Artist'       AS artist,
               metaData->>'$.CreateDate'   AS created,
               metaData->>'$.ModifyDate'   AS modified,
               metaData->>'$.ISO'          AS ISO,
               metaData->>'$.latitude'     AS latitude,
               metaData->>'$.longitude'    AS longitude
        FROM imageMetadata
        WHERE metaData->>'$.latitude' IS NOT NULL
          AND metaData->>'$.longitude' IS NOT NULL
        ORDER BY id DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });

  // PDF 

  // sök pdf på olika fält
  app.get('/api/pdf-search/:field/:value', async (req, res) => {
    const { field, value } = req.params;

    const allowed = ['filename','title','author','creator','numpages','creationdate','modedate'];
    if (!allowed.includes(field)) {
      return res.json([]);
    }

    let where = 'fileName';
    if (field === 'title')        where = "metaData->>'$.title'";
    if (field === 'author')       where = "metaData->>'$.author'";
    if (field === 'creator')      where = "metaData->>'$.creator'";
    if (field === 'numpages')     where = "metaData->>'$.numPages'";
    if (field === 'creationdate') where = "metaData->>'$.CreationDate'";
    if (field === 'modedate')     where = "metaData->>'$.modDate'";

    try {
      const [rows] = await db.execute(`
        SELECT id, fileName,
               metaData->>'$.title'        AS title,
               metaData->>'$.author'       AS author,
               metaData->>'$.creator'      AS creator,
               metaData->>'$.numPages'     AS numpages,
               metaData->>'$.CreationDate' AS creationdate,
               metaData->>'$.modDate'      AS modedate
        FROM pdfMeta
        WHERE LOWER(${where}) LIKE LOWER(?)
        ORDER BY id DESC
      `, ['%' + value + '%']);

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });

  // hämta all metadata för pdf
  app.get('/api/pdf-all-meta/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [rows] = await db.execute(
        `SELECT * FROM pdfMeta WHERE id = ?`, [id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });

  //  KARTA 

  // radiesökning på gps-bilder
  app.get('/api/map-image-search/:lat/:lon/:radius', async (req, res) => {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);
    const radius = parseFloat(req.params.radius);

    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(radius)) {
      return res.status(400).json({ error: 'lat/lon/radius måste vara numeriska' });
    }

    try {
      const [rows] = await db.execute(`
        SELECT id, fileName,
               metaData->>'$.latitude'  AS latitude,
               metaData->>'$.longitude' AS longitude
        FROM imageMetadata
        WHERE metaData->>'$.latitude' IS NOT NULL
          AND metaData->>'$.longitude' IS NOT NULL
      `);

      const R = 6371; // km
      const toRad = d => d * Math.PI / 180;

      const out = rows.map(r => {
        const la = parseFloat(r.latitude);
        const ln = parseFloat(r.longitude);
        const dLat = toRad(la - lat);
        const dLon = toRad(ln - lon);
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(toRad(lat)) * Math.cos(toRad(la)) *
                  Math.sin(dLon/2)**2;
        const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return {
          ...r,
          metadata: {
            latitude: la,
            longitude: ln,
            distance_km: Number(d.toFixed(1))
          }
        };
      }).filter(r => r.metadata.distance_km <= radius);

      res.json(out);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internt serverfel' });
    }
  });
}


