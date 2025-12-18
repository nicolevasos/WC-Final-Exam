const SIAM_CATEGORIES = {
    0:  { name: "00 Unclassified", color: "#000000" }, // Masked pixels
    1:  { name: "01 (SVHNIR) Strong Vegetation w/ High NIR", color: "#1efa1e" }, // Primary forest
    2:  { name: "02 (SVLNIR) Strong Vegetation w/ Low NIR", color: "#14af14" }, // Dense forest
    3:  { name: "03 (AVHNIR) Average Vegetation w/ High NIR", color: "#00dc5a" }, // Healthy crops
    4:  { name: "04 (AVLNIR) Average Vegetation w/ Low NIR", color: "#00aa6e" }, // Mature veg
    5:  { name: "05 (WV) Weak Vegetation", color: "#affa8c" }, // Sparse growth
    6:  { name: "06 (VSH_VWA_TWASH) Veg in Shadow/Water", color: "#647850" },
    7:  { name: "07 (SHRBRHNIR) Shrub Rangeland w/ High NIR", color: "#befaa0" },
    8:  { name: "08 (SHRBRLNIR) Shrub Rangeland w/ Low NIR", color: "#8caa6e" },
    9:  { name: "09 (HRBCR) Herbaceous Rangeland", color: "#e1fa32" }, // Grasslands/Pasture
    10: { name: "10 (WR) Weak Rangeland", color: "#c8c864" },
    11: { name: "11 (PB) Peat or Bog", color: "#648278" }, // Protected carbon sinks
    12: { name: "12 (GH) Greenhouse", color: "#afffff" },
    13: { name: "13 (VBBB) Very Bright Bare soil/Built-up", color: "#ffaa6e" },
    14: { name: "14 (BBB) Bright Bare soil/Built-up", color: "#e69b5f" }, // Deforestation indicator
    15: { name: "15 (SBB) Strong Bare soil/Built-up", color: "#d28c64" },
    16: { name: "16 (ABB) Average Bare soil/Built-up", color: "#b46446" },
    17: { name: "17 (DBB) Dark Bare soil/Built-up", color: "#8c3c32" },
    18: { name: "18 (WBBorBBSH) Weak Bare soil/Shadow", color: "#e6823c" },
    19: { name: "19 (NIRPBB) NIR-Peaked Bare soil", color: "#bebedc" },
    20: { name: "20 (BA) Burned area", color: "#823250" }, // Recent fire detection
    21: { name: "21 (DPWASH) Deep Water or Shadow", color: "#000050" },
    22: { name: "22 (SLWASH) Shallow Water or Shadow", color: "#00286e" },
    23: { name: "23 (TWASH) Turbid Water or Shadow", color: "#466482" },
    24: { name: "24 (SASLWA) Salty Shallow Water", color: "#6e0096" },
    25: { name: "25 (CL) Cloud", color: "#e6e6e6" },
    26: { name: "26 (SMKPLM) Smoke Plume", color: "#5a466e" },
    27: { name: "27 (TNCLV) Thin Cloud over Vegetation", color: "#c8e1af" },
    28: { name: "28 (TNCLWA_BB) Thin Cloud over Water/Soil", color: "#bebef5" },
    29: { name: "29 (SN_WAICE) Snow or Water Ice", color: "#1effff" },
    30: { name: "30 (SHSN) Snow in Shadow", color: "#00648c" },
    31: { name: "31 (SH) Shadow areas", color: "#14143c" },
    32: { name: "32 (FLAME) Flame, Active Fire", color: "#ff1446" },
    33: { name: "33 (UN) Unknown", color: "#ff0000" }
};

// --- MAP SETUP ---
const map = L.map('map', { crossOrigin: true }).setView([0, 0], 2);

// Using a tile layer that supports CORS
const satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Google Maps'
}).addTo(map);

// Add Search Bar
const searchControl = new GeoSearch.GeoSearchControl({
    provider: new GeoSearch.OpenStreetMapProvider(),
    style: 'bar',
});
map.addControl(searchControl);

// --- DRAWING LOGIC ---
let points = [];
let polyLayer = null;

map.on('click', (e) => {
    points.push(e.latlng);
    if (polyLayer) map.removeLayer(polyLayer);
    polyLayer = L.polygon(points, { color: 'yellow', fillOpacity: 0.2 }).addTo(map);
});

function clearArea() {
    points = [];
    if (polyLayer) map.removeLayer(polyLayer);
    document.getElementById('procCanvas').style.display = 'none';
}

// --- ANALYSIS LOGIC ---
async function processDrawnArea() {
    if (points.length < 3) return alert("Select at least 3 points!");

    const mapDiv = document.getElementById('map');
    const canvas = document.getElementById('procCanvas');
    const ctx = canvas.getContext('2d');

    // Hide the polygon temporarily to capture ONLY the satellite imagery
    if (polyLayer) polyLayer.setStyle({ opacity: 0, fillOpacity: 0 });

    const snapshot = await html2canvas(mapDiv, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: null
    });

    // Bring the polygon back immediately after the screenshot
    if (polyLayer) polyLayer.setStyle({ opacity: 1, fillOpacity: 0.2 });

    const ratioX = snapshot.width / mapDiv.offsetWidth;
    const ratioY = snapshot.height / mapDiv.offsetHeight;

    canvas.width = snapshot.width;
    canvas.height = snapshot.height;
    canvas.style.display = 'block';
    ctx.drawImage(snapshot, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const pixelPoints = points.map(p => {
        const point = map.latLngToContainerPoint(p);
        return { x: point.x * ratioX, y: point.y * ratioY };
    });
    
    const path = new Path2D();
    pixelPoints.forEach((p, i) => {
        if (i === 0) path.moveTo(p.x, p.y);
        else path.lineTo(p.x, p.y);
    });
    path.closePath();

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);

        if (ctx.isPointInPath(path, x, y)) {
            const r = data[i], g = data[i+1], b = data[i+2];
            let cat = 33;

            // SIAM-lite logic
            if (g > r && g > b) cat = 1; // Strong Veg
            else if (r > g && r > 150) cat = 14; // Bare Soil
            else if (r < 60 && g < 60 && b < 100) cat = 21; // Water/Shadow

            const rgb = hexToRgb(SIAM_CATEGORIES[cat].color);
            data[i] = rgb.r;
            data[i+1] = rgb.g;
            data[i+2] = rgb.b;
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function hexToRgb(hex) {
    const b = parseInt(hex.replace('#', ''), 16);
    return { r: (b >> 16) & 255, g: (b >> 8) & 255, b: b & 255 };
}
// Add Scale Bar to the bottom-right corner
L.control.scale({
    position: 'bottomright',
    metric: true,       // Shows kilometers/meters
    imperial: false     // Disable miles for EUDR/Scientific standard
}).addTo(map);
// Populate Legend
const leg = document.getElementById('legend');
Object.values(SIAM_CATEGORIES).forEach(c => {
    leg.innerHTML += `<div class="legend-item"><div class="color-box" style="background:${c.color}"></div><span>${c.name}</span></div>`;
});
