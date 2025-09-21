//  frontend/main.js
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const ok = (v) => {
  if (v === null || v === undefined) return 'Okänd';
  const s = String(v).trim();
  return (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') ? 'Okänd' : s;
};
async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(r.status);
  return r.json();
}

// Meny: visa rätt innehåll när man klickar i headern
document.body.addEventListener('click', e => {
  const navLink = e.target.closest('header nav a');
  if (!navLink) return;
  e.preventDefault();

  const label = navLink.textContent.trim();
  if (label === 'Start') showStart();
  else if (label === 'Sök') showSearch();
});

// Visa start-sida
function showStart(){
  $('main').innerHTML = `
    <h1>Start</h1>
    <p>Välkommen till vår metadata-sök. Här kan du söka i <b>bilder</b> och <b>PDF</b>.</p>
    <p>Välj fliken <b>Sök</b> i menyn för att börja, eller använd kartan för GPS-bilder.</p>
  `;
}

// Visa sök-sida (bilder + pdf)
function showSearch(){
  $('main').innerHTML = `
    <h1>Sök i filer</h1>

    <form id="searchForm" class="search-row card" style="gap:10px; align-items:center;">
      <input id="q" type="text" placeholder="Skriv t.ex. artist, titel eller filnamn..." />
      <select id="type" aria-label="Typ">
        <option value="all" selected>Alla</option>
        <option value="image">Bilder</option>
        <option value="pdf">PDF</option>
      </select>

      <label style="display:flex;align-items:center;gap:.4rem;margin-left:auto;">
        <input id="onlyGps" type="checkbox"> Endast bilder med GPS
      </label>

      <button class="btn" type="submit">Sök</button>
    </form>

    <!-- vilka fält vill vi visa/söka i? -->
    <section class="card" style="margin-top:12px;">
      <h3 style="margin:0 0 8px;">Fält att visa & söka i</h3>

      <p class="muted" style="margin:0 0 6px;">BILDER</p>
      <div class="fields-grid">
        <label><input class="show-image" value="fileName"  type="checkbox" checked> fileName</label>
        <label><input class="show-image" value="artist"    type="checkbox" checked> artist</label>
        <label><input class="show-image" value="created"   type="checkbox" checked> created</label>
        <label><input class="show-image" value="modified"  type="checkbox" checked> modified</label>
        <label><input class="show-image" value="ISO"       type="checkbox"> ISO</label>
        <label><input class="show-image" value="gps"       type="checkbox"> GPS</label>
      </div>

      <p class="muted" style="margin:12px 0 6px;">PDF</p>
      <div class="fields-grid">
        <label><input class="show-pdf" value="fileName"      type="checkbox" checked> filename</label>
        <label><input class="show-pdf" value="titel"         type="checkbox" checked> titel</label>
        <label><input class="show-pdf" value="author"        type="checkbox" checked> author</label>
        <label><input class="show-pdf" value="creator"       type="checkbox"> creator</label>
        <label><input class="show-pdf" value="numpages"      type="checkbox"> numpages</label>
        <label><input class="show-pdf" value="creationdate"  type="checkbox"> creationdate</label>
        <label><input class="show-pdf" value="modedate"      type="checkbox"> modedate</label>
      </div>
    </section>

    <div class="results-count" id="status" style="margin-top:10px;">0 träffar</div>
    <div id="results"></div>
  `;

  // Koppla event
  $('#searchForm').addEventListener('submit', onSearch);
  // Gör sökning direkt när man skriver/bytet typ/kryssar i fält
  $('main').addEventListener('keyup', e => { if (e.target.id === 'q') onSearch(e); });
  $('main').addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'type' || id === 'onlyGps' || e.target.classList.contains('show-image') || e.target.classList.contains('show-pdf')) {
      onSearch(e);
    }
  });
}

// Standard: visa start vid laddning
showStart();

// =================== Söklogik ===================

// Sökbara fält (måste matcha backend)
const SEARCHABLE_IMAGE = ['filename','artist','created','modified','ISO'];
const SEARCHABLE_PDF   = ['filename','titel','author','creator','numpages','creationdate','modedate'];

function setStatus(n){
  const el = $('#status');
  if (el) el.textContent = `${n} träffar`;
}

function collectShowFields(){
  const img = $$('.show-image:checked').map(x=>x.value);
  const pdf = $$('.show-pdf:checked').map(x=>x.value);
  return {
    image: img.length ? img : ['filename','artist','created','modified'],
    pdf:   pdf.length ? pdf : ['filename','titel','author']
  };
}

// Render-kort för bild
function imageCard(row, showFields){
  const fn  = row.fileName || row.filename || 'Okänd';
  const url = `/images/${encodeURIComponent(fn)}`;
  const md  = row.metaData || row.metadata || {};

  const lat = Number(md.latitude);
  const lon = Number(md.longitude);

  // Fallbacks för datum och andra vanliga fält
  const valueFor = (f) => {
    switch (f) {
      case 'fileName':
        return fn;
      case 'artist':
        return ok(row.artist ?? md.Artist);
      case 'ISO':
        return ok(row.ISO ?? md.ISO);
      case 'created':
        // EXIF (created) → annars filsystemets createdFs → ev. md.CreateDate → annars row.created
        return ok(row.created ?? row.createdFs ?? md.CreateDate ?? md.created);
      case 'modified':
        // EXIF (modified) → annars filsystemets modifiedFs → ev. md.ModifyDate → annars row.modified
        return ok(row.modified ?? row.modifiedFs ?? md.ModifyDate ?? md.modified);
      default:
        return ok(row[f]);
    }
  };

  const gpsLine = (showFields.includes('gps') && Number.isFinite(lat) && Number.isFinite(lon))
    ? `<div><b>GPS:</b> ${ok(lat)}, ${ok(lon)}</div>` : '';

  const lines = showFields
    .filter(f => f !== 'gps')
    .map(f => `<div><b>${f}:</b> ${valueFor(f)}</div>`)
    .join('');

  return `
    <article class="card">
      <h3>Bild</h3>
      ${lines}
      ${gpsLine}
      <div class="actions" style="margin-top:8px;">
        <a class="btn" href="${url}" target="_blank" rel="noopener">Öppna</a>
        <a class="btn" href="${url}" download>Hämta</a>
        <button class="btn-outline toggle-meta" data-kind="image" data-id="${row.id}">Visa metadata</button>
      </div>
      <pre id="meta-image-${row.id}" style="display:none"></pre>
    </article>
  `;
}

// Render-kort för pdf
function pdfCard(row, showFields){
  const fn  = row.fileName || row.filename || 'Okänd';
  const url = `/pdf-filer/${encodeURIComponent(fn)}`;
  const lines = showFields.map(f => `<div><b>${f}:</b> ${ok(row[f])}</div>`).join('');
  return `
    <article class="card">
      <h3>PDF</h3>
      ${lines}
      <div class="actions" style="margin-top:8px;">
        <a class="btn" href="${url}" target="_blank" rel="noopener">Öppna</a>
        <a class="btn" href="${url}" download>Hämta</a>
        <button class="btn-outline toggle-meta" data-kind="pdf" data-id="${row.id}">Visa metadata</button>
      </div>
      <pre id="meta-pdf-${row.id}" style="display:none"></pre>
    </article>
  `;
}

function bindMetaToggles(container){
  container.querySelectorAll('.toggle-meta').forEach(btn => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.kind;
      const id   = btn.dataset.id;
      const pre  = document.getElementById(`meta-${kind}-${id}`);

      if (pre.style.display === 'none') {
        if (!pre.textContent.trim()) {
          try {
            const data = await getJSON(`/api/${kind}-all-meta/${encodeURIComponent(id)}`);
            pre.textContent = JSON.stringify(data, null, 2);
          } catch { pre.textContent = 'Kunde inte hämta metadata.'; }
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

// Huvudsök (kallas från submit, keyup, change)
async function onSearch(e){
  if (e) e.preventDefault();
  const q       = $('#q')?.value?.trim() || '';
  const type    = $('#type')?.value || 'all';
  const onlyGps = $('#onlyGps')?.checked || false;
  const show    = collectShowFields();

  const out = [];
  const seen = new Set();

  // Tom sök + (image/all) + gpsOnly -> lista alla GPS-bilder
  if (!q && (type === 'image' || type === 'all') && onlyGps){
    try {
      const rows = await getJSON('/api/images');
      rows.forEach(r => { const k='img:'+r.id; if(!seen.has(k)){ seen.add(k); out.push({__t:'image', row:r}); } });
    } catch {}
  }

  // Söksträng finns: anropa relevanta endpoints
  if (q){
    if (type === 'image' || type === 'all'){
      for (const f of SEARCHABLE_IMAGE){
        try{
          const url  = `/api/image-search/${f}/${encodeURIComponent(q)}${onlyGps ? '?gps=1' : ''}`;
          const list = await getJSON(url);
          list.forEach(r => { const k='img:'+r.id; if(!seen.has(k)){ seen.add(k); out.push({__t:'image', row:r}); } });
        }catch{}
      }
    }
    if (type === 'pdf' || type === 'all'){
      for (const f of SEARCHABLE_PDF){
        try{
          const url  = `/api/pdf-search/${f}/${encodeURIComponent(q)}`;
          const list = await getJSON(url);
          list.forEach(r => { const k='pdf:'+r.id; if(!seen.has(k)){ seen.add(k); out.push({__t:'pdf', row:r}); } });
        }catch{}
      }
    }
  }

  // Sortera och rendera
  out.sort((a,b)=> (b.row.id||0)-(a.row.id||0));
  setStatus(out.length);

  const box = $('#results');
  if (!out.length){
    box.innerHTML = `<div class="card">Inga träffar.</div>`;
    return;
  }

  box.innerHTML = out.map(x =>
    x.__t === 'image' ? imageCard(x.row, show.image) : pdfCard(x.row, show.pdf)
  ).join('');

  bindMetaToggles(box);
}




