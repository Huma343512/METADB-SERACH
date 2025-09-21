// enkel hjälp att hämta element
const $ = s => document.querySelector(s);

let map, clickMarker, circle, infoWin;
let markers = [];

// visa text som "3 träffar"
function setStatus(n) {
  $('#status').textContent = n + " träffar";
}

// rensa gamla markörer
function clearMarkers() {
  markers.forEach(m => m.setMap(null));
  markers = [];
}

// rita cirkel
function drawCircle(lat, lon, radiusKm) {
  if (circle) circle.setMap(null);
  circle = new google.maps.Circle({
    map,
    center: { lat, lng: lon },
    radius: radiusKm * 1000,
    fillColor: "#5b5bd6",
    fillOpacity: 0.15,
    strokeColor: "#5b5bd6",
    strokeOpacity: 0.6
  });
}

// visa listan under kartan
function renderList(items) {
  if (!items.length) {
    $('#results').innerHTML = `<div class="card">Inga träffar.</div>`;
    return;
  }
  $('#results').innerHTML = items.map(img => {
    let fn = img.fileName || img.filename || "okänd fil";
    let lat = img.metadata?.latitude;
    let lon = img.metadata?.longitude;
    let dist = img.metadata?.distance_km;
    let url = `/images/${encodeURIComponent(fn)}`;
    return `
      <article class="card">
        <h3>${fn}</h3>
        <p>GPS: ${lat}, ${lon} · Avstånd: ${dist} km</p>
        <div class="actions">
          <a class="btn" href="${url}" target="_blank">Öppna</a>
          <a class="btn" href="${url}" download>Hämta</a>
        </div>
      </article>
    `;
  }).join("");
}

// hämta data från backend och visa på karta + lista
async function searchNearby(lat, lon, radiusKm) {
  try {
    let r = await fetch(`/api/map-image-search/${lat}/${lon}/${radiusKm}`);
    let items = await r.json();

    setStatus(items.length);
    renderList(items);
    clearMarkers();

    let bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat, lng: lon });

    items.forEach(img => {
      let la = img.metadata?.latitude;
      let ln = img.metadata?.longitude;
      if (!la || !ln) return;

      let marker = new google.maps.Marker({
        map,
        position: { lat: la, lng: ln },
        title: img.fileName
      });
      markers.push(marker);
      bounds.extend(marker.getPosition());

      marker.addListener("click", () => {
        if (!infoWin) infoWin = new google.maps.InfoWindow();
        infoWin.setContent(`<b>${img.fileName}</b><br>GPS: ${la}, ${ln}`);
        infoWin.open(map, marker);
      });
    });

    if (items.length) map.fitBounds(bounds);
  } catch {
    setStatus(0);
    $('#results').innerHTML = `<div class="card">Fel vid hämtning</div>`;
  }
}

// starta kartan
function initMap() {
  let start = { lat: 59.33, lng: 18.06 }; // Stockholm
  map = new google.maps.Map($('#map'), { center: start, zoom: 6 });

  // klick i kartan
  map.addListener("click", ev => {
    let lat = ev.latLng.lat();
    let lon = ev.latLng.lng();
    let radiusKm = Number($('#radius').value);

    if (!clickMarker) {
      clickMarker = new google.maps.Marker({ map, position: { lat, lng: lon } });
    } else {
      clickMarker.setPosition({ lat, lng: lon });
    }

    drawCircle(lat, lon, radiusKm);
    searchNearby(lat, lon, radiusKm);
  });

  // ändra radie efter klick
  $('#radius').addEventListener("change", () => {
    if (!clickMarker) return;
    let pos = clickMarker.getPosition();
    searchNearby(pos.lat(), pos.lng(), Number($('#radius').value));
    drawCircle(pos.lat(), pos.lng(), Number($('#radius').value));
  });
}

// viktigt för Google Maps callback
window.initMap = initMap;





