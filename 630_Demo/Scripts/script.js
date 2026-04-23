function webMercatorToLatLng(x, y) {
    const lng = (x / 20037508.34) * 180;
    let lat = (y / 20037508.34) * 180;
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
    return { lat, lng };
}


async function loadAllData() {
    const [parksData, arcgisData, spotsData] = await Promise.all([
        fetch('data/nationalparks.json').then(r => r.json()),
        fetch('data/arcgis_parks.json').then(r => r.json()),
        fetch('data/eat_stay.json').then(r => r.json())
    ]);


    const arcgisParks = arcgisData.layers[3].featureSet.features.map(f => ({
        name: f.attributes.TITLE,
        ...webMercatorToLatLng(f.geometry.x, f.geometry.y),
        country: 'Costa Rica',
        zone: assignZone(f.attributes.TITLE)
    }));


    
    const existingNames = parksData.map(p => p.name.toLowerCase());
    const newParks = arcgisParks.filter(p => 
        !existingNames.includes(p.name.toLowerCase())
    );
    const allParks = [...parksData, ...newParks];

    return { parks: allParks, spots: spotsData };
}

function assignZone(parkName) {
    const zoneMap = {
        'Arenal Volcano National Park': 'central_valley',
        'Tortuguero National Park': 'caribbean',
        'Corcovado National Park': 'osa',
        'Chirripó National Park': 'cloud_forest',
        'Santa Rosa National Park': 'guanacaste',
        'Guanacaste National Park': 'guanacaste',
        'Rincón de la Vieja Volcano National Park': 'guanacaste',
        'Palo Verde National Park': 'guanacaste',
        'Barra Honda National Park': 'guanacaste',
        'Diria National Park': 'guanacaste',
        'Irazú Volcano National Park': 'central_valley',
        'Turrialba National Park': 'central_valley',
        'Tapantí National Park': 'central_valley',
        'Barbilla National Park': 'caribbean',
        'La Amistad International National Park': 'cloud_forest',
        'Piedras Blancas National Park': 'osa'
    };
    return zoneMap[parkName] || 'unknown';
}

let map;
let parkMarkers = L.layerGroup();
let zoneLayer = null;
let spotsMarkers = L.layerGroup();
let zoneOverlay = null; //zone overlay state machine

function initMap() {
    const costaRicaBounds = L.latLngBounds(
        [8.0, -86.0],
        [11.5, -82.5]
    );

    map = L.map('costa-rica-map', {
        maxBounds: costaRicaBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7,
        maxZoom: 12,
        zoomControl: false
    });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CartoDB'
    }).addTo(map);
    
    map.setView([9.7489, -83.7534], 8);

    setTimeout(() => map.invalidateSize(), 100);//force leaflet to re do layout after end of zoom
    
    parkMarkers.addTo(map);
    spotsMarkers.addTo(map);
}

const zoneConfigs = {
    intro: {
        center: [9.7489, -83.7534],
        zoom: 8
    },
    guanacaste: {
        center: [10.6, -85.4],
        zoom: 9,
        color: '#f15609'
    },
    central_valley: {
        center: [9.9, -84.1],
        zoom: 10,
        color: '#cdeddc'
    },
    caribbean: {
        center: [10.2, -83.5],
        zoom: 9,
        color: '#bbcfdd'
    },
    osa: {
        center: [8.5, -83.5],
        zoom: 10,
        color: '#818f89'
    },
    cloud_forest: {
        center: [10.3, -84.8],
        zoom: 10,
        color: '#b7d4c8'
    }
};

let currentZone = null;//I know I'm sorry but yes a state machine

async function loadZoneOverlay(zoneName, color) {
    
    if (zoneOverlay) {
        map.removeLayer(zoneOverlay);
        zoneOverlay = null;
    }

    if (zoneName === 'intro') return;

    const fileMap = {
        guanacaste: 'data/guanacaste_overlay.json',
        // since I only made one for this, add others here as you make new maps
    };

    const file = fileMap[zoneName];
    if (!file) return;

    const geojson = await fetch(file).then(r => r.json());

        zoneOverlay = L.geoJSON(geojson, {
    style: {
        fillColor: color,
        fillOpacity: 0.25,
        color: color,
        weight: 1.5,
        opacity: 0.9
    },
    // add this:
    coordsToLatLng: function(coords) {
        return L.latLng(coords[1], coords[0]);
    }
}).addTo(map);
}

function activateZone(zoneName, parks, spots) {
    const config = zoneConfigs[zoneName];
    if (!config) return;
    
    clearAllMarkers();
    map.setView(config.center, config.zoom, {
        animate: true,
        duration: 2,
    easeLinearity: 0.1
    });

    setTimeout(() => {
        loadZoneOverlay(zoneName, config.color);
    }, 500);

    // parkMarkers.clearLayers();
    // spotsMarkers.clearLayers();

    if (zoneName === 'intro') return;
    
     
    // moved the spot markers from here to initbuttonlisteners
}

function initScrollTrigger(parks, spots) {
    gsap.registerPlugin(ScrollTrigger);

    const panels = gsap.utils.toArray('.panel');

    panels.forEach(panel => {
        const zoneName = panel.dataset.zone;

        ScrollTrigger.create({
            trigger: panel,
            start: 'top 60%', //a rectangle of trigger instead of a line
            end: 'bottom 40%',
            /*start: 'top center',*/
            onEnter: () => activateZone(zoneName, parks, spots),
            onEnterBack: () => activateZone(zoneName, parks, spots)//,
            //onLeaveBack: () => activateZone('intro', parks, spots)
           
            
        });
    });
}

const activeButtons = {
    eat: false,
    stay: false,
    parks: false
};

function clearAllMarkers() {
    parkMarkers.clearLayers();
    spotsMarkers.clearLayers();
    activeButtons.eat = false;
    activeButtons.stay = false;
    activeButtons.parks = false;
    // Reset button styles
    document.querySelectorAll('.btn-eat, .btn-stay, .btn-np').forEach(btn => {
        btn.classList.remove('active');
    });
    // Hide all spot lists
    document.querySelectorAll('.panel-spots').forEach(el => {
        el.classList.add('hidden');
        el.innerHTML = '';
    });

    document.querySelectorAll('.panel-spots, [id^="parks-"]').forEach(el => {
    el.classList.add('hidden');
    el.innerHTML = '';
});
}

function initButtonListeners(parks, spots) {
    document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-eat')) {
            const zone = e.target.dataset.zone;
            const spotsDiv = document.querySelector(`#spots-${zone}`);
            const filtered = spots.filter(s => s.zone === zone && s.type === 'eating');

            if (!activeButtons.eat) {
                activeButtons.eat = true;
                e.target.classList.add('active');
                spotsDiv.classList.remove('hidden');
                spotsDiv.innerHTML = filtered.length > 0
                    ? filtered.map(s => `
                        <div class="spot-item">
                            <strong>${s.name}</strong><br>
                            <small>${s.description} · ${s.price_range ?? ''}</small>
                        </div>`).join('')
                    : '<div class="spot-item">No spots yet.</div>';
                filtered.forEach(spot => {
                    const marker = L.circleMarker([spot.lat, spot.lng], {
                        radius: 8,
                        fillColor: '#eefd80',
                        color: '#ffffff',
                        weight: 1.5,
                        fillOpacity: 0.9
                    }).bindPopup(`
                        <div style="font-family: DM Sans, sans-serif;">
                            <strong>${spot.name}</strong><br>
                            ${spot.description ?? ''}<br>
                            <small>${spot.price_range ?? ''}</small>
                        </div>`);
                    spotsMarkers.addLayer(marker);
                });
            } else {
                activeButtons.eat = false;
                e.target.classList.remove('active');
                spotsDiv.classList.add('hidden');
                spotsDiv.innerHTML = '';
                // Only clear eat markers, keep stay markers if active
                spotsMarkers.clearLayers();
                if (activeButtons.stay) {
                    spots.filter(s => s.zone === zone && s.type === 'staying').forEach(spot => {
                        L.circleMarker([spot.lat, spot.lng], {
                            radius: 8, fillColor: '#eefd80',
                            color: '#ffffff', weight: 1.5, fillOpacity: 0.9
                        }).addTo(spotsMarkers);
                    });
                }
            }
        }

        // WHERE TO STAY
        if (e.target.matches('.btn-stay')) {
            const zone = e.target.dataset.zone;
            const spotsDiv = document.querySelector(`#spots-${zone}`);
            const filtered = spots.filter(s => s.zone === zone && s.type === 'staying');

            if (!activeButtons.stay) {
                activeButtons.stay = true;
                e.target.classList.add('active');
                spotsDiv.classList.remove('hidden');
                spotsDiv.innerHTML = filtered.length > 0
                    ? filtered.map(s => `
                        <div class="spot-item">
                            <strong>${s.name}</strong><br>
                            <small>${s.description} · ${s.price_range ?? ''}</small>
                        </div>`).join('')
                    : '<div class="spot-item">No spots yet.</div>';
                filtered.forEach(spot => {
                    const marker = L.circleMarker([spot.lat, spot.lng], {
                        radius: 8,
                        fillColor: '#a8d8ea',
                        color: '#ffffff',
                        weight: 1.5,
                        fillOpacity: 0.9
                    }).bindPopup(`
                        <div style="font-family: DM Sans, sans-serif;">
                            <strong>${spot.name}</strong><br>
                            ${spot.description ?? ''}<br>
                            <small>${spot.price_range ?? ''}</small>
                        </div>`);
                    spotsMarkers.addLayer(marker);
                });
            } else {
                activeButtons.stay = false;
                e.target.classList.remove('active');
                spotsDiv.classList.add('hidden');
                spotsDiv.innerHTML = '';
                spotsMarkers.clearLayers();
                if (activeButtons.eat) {
                    spots.filter(s => s.zone === zone && s.type === 'eating').forEach(spot => {
                        L.circleMarker([spot.lat, spot.lng], {
                            radius: 8, fillColor: '#eefd80',
                            color: '#ffffff', weight: 1.5, fillOpacity: 0.9
                        }).addTo(spotsMarkers);
                    });
                }
            }
        }

        // NATIONAL PARKS
        if (e.target.matches('.btn-np')) {
            const zone = e.target.dataset.zone;
            const config = zoneConfigs[zone];
            const parksDiv = document.querySelector(`#parks-${zone}`);
            const filtered = parks.filter(p => p.zone === zone);

            if (!activeButtons.parks) {
                activeButtons.parks = true;
                e.target.classList.add('active');

                parksDiv.classList.remove('hidden');
        parksDiv.innerHTML = filtered.length > 0
            ? filtered.map(p => `
                <div class="spot-item">
                    <strong>${p.name}</strong><br>
                    <small>${p.description ?? ''}</small>
                </div>`).join('')
            : '<div class="spot-item">No parks listed yet.</div>';

                parks.filter(p => p.zone === zone).forEach(park => {
                    const marker = L.circleMarker([park.lat, park.lng], {
                        radius: 8,
                        fillColor: config.color,
                        color: '#ffffff',
                        weight: 1.5,
                        fillOpacity: 0.9
                    }).bindPopup(`
                        <div style="font-family: DM Sans, sans-serif;">
                            <strong>${park.name}</strong><br>
                            <small>${park.description ?? ''}</small>
                        </div>`);
                    parkMarkers.addLayer(marker);
                });
            } else {
                activeButtons.parks = false;
                e.target.classList.remove('active');
                parkMarkers.clearLayers();
                parksDiv.classList.add('hidden');  
                parksDiv.innerHTML = '';  
            }
        }
    });
}



async function init() {
    const { parks, spots } = await loadAllData();
    initMap();
    initScrollTrigger(parks, spots);
    initButtonListeners(parks,spots);
}

init();