const mapboxgl = require('mapbox-gl');
const h3 = require('h3-js')
const geojson2h3 = require('geojson2h3')

// public token
mapboxgl.accessToken = 'pk.eyJ1IjoibWF0dGhpYXNmZWlzdCIsImEiOiJjbDB0ZWc1dHcwY2J3M2NsemR3bXJrMHVvIn0.GcKiU5EBVtrQjdp29y5wAA';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: [15, 50],
  zoom: 3,
  maxBounds: [ [-170, -85], [170, 85] ]
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
      'text-halo-color': '#fff',
      'text-halo-width': 0.5
    }
  });

  updateTiles();
});

map.on('moveend', updateTiles);

function updateTiles() {
  var extentsGeom = getExtentsGeom();
  const mapZoom = map.getZoom()
  let h3zoom = Math.max(0, Math.floor((mapZoom-3) * 0.8))

  const h3indexes = h3.polyfill(extentsGeom, h3zoom, true)

  map.getSource('tiles-geojson').setData({
    type: 'FeatureCollection',
    features: h3indexes.map(getTileFeature)
  });

  map.getSource('tiles-centers-geojson').setData({
    type: 'FeatureCollection',
    features: h3indexes.map(getTileCenterFeature)
  });
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
  return geojson2h3.h3ToFeature(h3index, {
    pentagon: h3.h3IsPentagon(h3index),
  })
}

function getTileCenterFeature(h3index) {
  var center = h3.h3ToGeo(h3index)
  return {
    type: 'Feature',
    properties: {
      text: h3index + '\nRes: ' + h3.h3GetResolution(h3index),
    },
    geometry: {
      type: 'Point',
      coordinates: [center[1],center[0]]
    }
  };
}
