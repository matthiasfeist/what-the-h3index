const mapboxgl = require('mapbox-gl');
const h3 = require('h3-js')
const geojson2h3 = require('geojson2h3')

// public token
mapboxgl.accessToken = 'pk.eyJ1IjoibWF0dGhpYXNmZWlzdCIsImEiOiJjbDB0ZWc1dHcwY2J3M2NsemR3bXJrMHVvIn0.GcKiU5EBVtrQjdp29y5wAA';

let h3IndexToHighlight = '';
const h3Input = document.getElementById('zoomToIndex');

let map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: [15, 50],
  zoom: 3,
  maxBounds: [[-170, -85], [170, 85]]
});

map.on('load', () => {
  map.addSource('tiles-geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addSource('tiles-centers-geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addLayer({
    id: 'tiles',
    source: 'tiles-geojson',
    type: 'line',
    paint: {
      'line-color': '#000'
    }
  });

  map.addLayer({
    id: 'tiles-shade',
    source: 'tiles-geojson',
    type: 'fill',
    paint: {
      'fill-color': ['case', ['get', 'pentagon'], 'rgba(255,0,0,0.5)', 'rgba(0,0,0,0.1)']
    }
  });

  map.addLayer({
    id: 'tiles-centers',
    source: 'tiles-centers-geojson',
    type: 'symbol',
    layout: {
      'text-field': ['format', ['get', 'text'], { 'font-scale': 1.2 }],
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': '#000',
      'text-color-transition': {
        duration: 0
      },
      'text-halo-color': ['case', ['get', 'highlight'], '#0f0', '#fff'],
      'text-halo-width': 1,
      'text-halo-blur': 1
    }
  });

  updateTiles();
});

map.on('moveend', updateTiles);
map.on('click', (e) => {
  const h3Index = h3.geoToH3(e.lngLat.lat, e.lngLat.lng, mapZoomToH3Res(map.getZoom()))
  h3Input.value = h3Index
});

h3Input.addEventListener('change', (e) => {
  const input = h3Input.value
  if (!h3.h3IsValid(input)) {
    alert('input is not a valid H3 index')
    return
  }
  h3IndexToHighlight = input
  const res = h3.h3GetResolution(input)
  const [lat, lng] = h3.h3ToGeo(input)

  map.flyTo({
    center: [lng, lat],
    zoom: h3ResToMapZoom(res)
  });
});


function updateTiles() {
  var extentsGeom = getExtentsGeom();
  const mapZoom = map.getZoom()
  let h3res = mapZoomToH3Res(mapZoom)

  const h3indexes = extendH3IndexesByOne(h3.polyfill(extentsGeom, h3res, true))

  map.getSource('tiles-geojson').setData(
    {
      type: 'FeatureCollection',
      features: h3indexes.map(getTileFeature)
    });

  map.getSource('tiles-centers-geojson').setData({
    type: 'FeatureCollection',
    features: h3indexes.map(getTileCenterFeature)
  });
}

function extendH3IndexesByOne(indexes) {
  const set = new Set()
  indexes.forEach(index => {
    h3.kRing(index, 1).forEach(ringIndex => set.add(ringIndex))
  })
  return Array.from(set)
}

function getExtentsGeom() {
  var e = map.getBounds();
  return [
    e.getSouthWest().toArray(),
    e.getNorthWest().toArray(),
    e.getNorthEast().toArray(),
    e.getSouthEast().toArray(),
    e.getSouthWest().toArray()
  ];
}

function getTileFeature(h3index) {
  const feature = geojson2h3.h3ToFeature(h3index, {
    pentagon: h3.h3IsPentagon(h3index),
  })
  fixTransmeridian(feature)
  return feature
}

function getTileCenterFeature(h3index) {
  var center = h3.h3ToGeo(h3index)
  return {
    type: 'Feature',
    properties: {
      text: h3index + '\nRes: ' + h3.h3GetResolution(h3index),
      highlight: h3index === h3IndexToHighlight
    },
    geometry: {
      type: 'Point',
      coordinates: [center[1], center[0]]
    }
  };
}

function mapZoomToH3Res(zoom) {
  return Math.max(0, Math.floor((zoom - 3) * 0.8))
}
function h3ResToMapZoom(res) {
  return Math.ceil((res + 3) * 1.2)
}

/**************************** 
 * the follwing functions are copied from
 * https://observablehq.com/@nrabinowitz/mapbox-utils#fixTransmeridian
 ****************************/

function fixTransmeridianCoord(coord) {
  const lng = coord[0];
  coord[0] = lng < 0 ? lng + 360 : lng;
}

function fixTransmeridianLoop(loop) {
  let isTransmeridian = false;
  for (let i = 0; i < loop.length; i++) {
    // check for arcs > 180 degrees longitude, flagging as transmeridian
    if (Math.abs(loop[0][0] - loop[(i + 1) % loop.length][0]) > 180) {
      isTransmeridian = true;
      break;
    }
  }
  if (isTransmeridian) {
    loop.forEach(fixTransmeridianCoord);
  }
}

function fixTransmeridianPolygon(polygon) {
  polygon.forEach(fixTransmeridianLoop);
}

function fixTransmeridian(feature) {
  const { type } = feature;
  if (type === 'FeatureCollection') {
    feature.features.map(fixTransmeridian);
    return;
  }
  const { type: geometryType, coordinates } = feature.geometry;
  switch (geometryType) {
    case 'LineString':
      fixTransmeridianLoop(coordinates);
      return;
    case 'Polygon':
      fixTransmeridianPolygon(coordinates);
      return;
    case 'MultiPolygon':
      coordinates.forEach(fixTransmeridianPolygon);
      return;
    default:
      throw new Error(`Unknown geometry type: ${geometryType}`);
  }
}