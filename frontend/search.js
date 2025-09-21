// Enkel sök för bilder och PDF
// - Använder fileName för båda
// - Har Visa/Dölj metadata-knapp
// - "Öppna" = öppna i webbläsare, "Hämta" = ladda ned filen

const $ = s => document.querySelector(s);

// Hjälpfunktion för att hämta JSON
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return [];
  return r.json();
}

// Om värde saknas → "Okänd"
const ok = v => (v == null || v === '') ? 'Okänd' : v;

// Rita själva sök-UI:t
function renderSearchUI() {
  $('#app').innerHTML = `
    <h1>Sök filer</h1>

    <form id="searchForm" class="search-row card">
      <input id="q" type="text" placeholder="Skriv något..." />
      <select id="type">
        <option value="all">Alla</option>
        <option value="image">Bilder</option>
        <option value="pdf">PDF</option>
      </select>
      <label>
        <input id="onlyGps" type="checkbox"> Endast GPS-bilder
      </label>
      <button class="btn" type="submit">Sök</button>
    </form>

    <section class="card">
      <h3>Bilder – fält</h3>
      <label><input class="show-image" value="filename" type="checkbox" checked> filename</label>
      <label><input class="show-image" value="artist" type="checkbox" checked> artist</label>
      <label><input class="show-image" value="created" type="checkbox"> created</label>
      <label><input class="show-image" value="modified" type="checkbox"> modified</label>
      <label><input class="show-image" value="ISO" type="checkbox"> ISO</label>
      <label><input class="show-image" value="gps" type="checkbox"> GPS</label>

      <h3>PDF – fält</h3>
      <label><input class="show-pdf" value="filename" type="checkbox" checked> filename</label>
      <label><input class="show-pdf" value="title" type="checkbox" checked> title</label>
      <label><input class="show-pdf" value="author" type="checkbox"> author</label>
      <label><input class="show-pdf" value="creator" type="checkbox"> creator</label>
      <label><input class="show-pdf" value="numpages" type="checkbox"> numpages</label>
      <label><input class="show-pdf" value="creationdate" type="checkbox"> creationdate</label>
      <label><input class="show-pdf" value="modedate" type="checkbox"> modedate</label>
    </section>

    <div id="status" class="results-count">0 träffar</div>
    <div id="results"></div>
  `;
}

// Hämta valda fält (checkboxar)
function selectedFields() {
  const image = [...document.querySelectorAll('.show-image:checked')].map(x => x.value);
  const pdf   = [...document.querySelectorAll('.show-pdf:checked')].map(x => x.value);
  return { image, pdf };
}

// Bygg kort för bild
function imageCard(row, fields) {
  const fn  = row.fileName || 'Okänd';
  const url = `/images/${encodeURIComponent(fn)}`;
  const md  = row.metaData || row.metadata || {};
  const lat = Number(md.latitude), lon = Number(md.longitude);

  const lines = fields.filter(f => f !== 'gps').map(f => {
    const val = (f === 'filename') ? fn : row[f];
    return `<div><b>${f}:</b> ${ok(val)}</div>`;
  }).join('');

  const gps = (fields.includes('gps') && Number.isFinite(lat) && Number.isFinite(lon))
    ? `<div><b>GPS:</b> ${lat}, ${lon}</div>` : '';

  return `
    <article class="card">
      <h3>Bild</h3>
      ${lines}${gps}
      <div class="actions">
        <a class="btn" href="${url}" target="_blank" rel="noopener">Öppna</a>
        <a class="btn" href="${url}" download>Hämta</a>
        <button class="btn-outline toggle-meta" data-kind="image" data-id="${row.id}">Visa metadata</button>
      </div>
      <pre id="meta-image-${row.id}" style="display:none"></pre>
    </article>
  `;
}

// Bygg kort för PDF
function pdfCard(row, fields) {
  const fn  = row.fileName || 'Okänd';
  const url = `/pdf-filer/${encodeURIComponent(fn)}`;

  const lines = fields.map(f => {
    const val = (f === 'filename') ? fn : row[f];
    return `<div><b>${f}:</b> ${ok(val)}</div>`;
  }).join('');

  return `
    <article class="card">
      <h3>PDF</h3>
      ${lines}
      <div class="actions">
        <a class="btn" href="${url}" target="_blank" rel="noopener">Öppna</a>
        <a class="btn" href="${url}" download>Hämta</a>
        <button class="btn-outline toggle-meta" data-kind="pdf" data-id="${row.id}">Visa metadata</button>
      </div>
      <pre id="meta-pdf-${row.id}" style="display:none"></pre>
    </article>
  `;
}

// Hantera Visa/Dölj metadata-knapparna
function bindMetaToggles(container) {
  container.querySelectorAll('.toggle-meta').forEach(btn => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.kind;
      const id   = btn.dataset.id;
      const pre  = document.getElementById(`meta-${kind}-${id}`);

      if (pre.style.display === 'none') {
        if (!pre.textContent.trim()) {
          const data = await getJSON(`/api/${kind}-all-meta/${id}`);
          pre.textContent = JSON.stringify(data, null, 2);
        }
        pre.style.display = 'block';
        btn.textContent = 'Dölj metadata';
      } else {
        pre.style.display = 'none';
        btn.textContent = 'Visa metadata';
      }
    });
  });
}

/* =======================
   ENDA ÄNDRINGEN: onSearch
   ======================= */
async function onSearch(e) {
  e.preventDefault();

  const q       = $('#q').value.trim();
  const type    = $('#type').value;
  const onlyGps = $('#onlyGps').checked;
  const fields  = selectedFields();

  // Tomt sökord → visa bara om GPS-läge
  if (!q && !(onlyGps && (type === 'image' || type === 'all'))) {
    $('#status').textContent = '0 träffar';
    $('#results').innerHTML = '';
    return;
  }

  const out  = [];
  const seen = new Set(); // undvik dubbletter (id)

  // Special: alla GPS-bilder
  if (!q && onlyGps && (type === 'image' || type === 'all')) {
    const list = await getJSON('/api/images');
    for (const r of list) {
      const key = `img:${r.id}`;
      if (!seen.has(key)) { seen.add(key); out.push({ kind: 'image', row: r }); }
    }
  }

  // Vanlig sökning: testa flera fält
  if (q) {
    if (type === 'all' || type === 'image') {
      // Bilder: artist + filename
      const imgFields = ['artist', 'filename'];
      for (const f of imgFields) {
        const url  = `/api/image-search/${encodeURIComponent(f)}/${encodeURIComponent(q)}${onlyGps ? '?gps=1' : ''}`;
        const list = await getJSON(url);
        for (const r of list) {
          const key = `img:${r.id}`;
          if (!seen.has(key)) { seen.add(key); out.push({ kind: 'image', row: r }); }
        }
      }
    }
    if (type === 'all' || type === 'pdf') {
      // PDF: author + title + filename
      const pdfFields = ['author', 'title', 'filename'];
      for (const f of pdfFields) {
        const url  = `/api/pdf-search/${encodeURIComponent(f)}/${encodeURIComponent(q)}`;
        const list = await getJSON(url);
        for (const r of list) {
          const key = `pdf:${r.id}`;
          if (!seen.has(key)) { seen.add(key); out.push({ kind: 'pdf', row: r }); }
        }
      }
    }
  }

  // Visa resultat
  out.sort((a,b) => (b.row.id||0) - (a.row.id||0));
  $('#status').textContent = `${out.length} träffar`;

  const box = $('#results');
  box.innerHTML = out.map(r =>
    r.kind === 'image' ? imageCard(r.row, fields.image) : pdfCard(r.row, fields.pdf)
  ).join('');

  bindMetaToggles(box);
}

// Starta sidan
document.addEventListener('DOMContentLoaded', () => {
  renderSearchUI();
  $('#searchForm').addEventListener('submit', onSearch);
});
