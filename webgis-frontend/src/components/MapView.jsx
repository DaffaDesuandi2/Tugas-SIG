import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

function MapView() {
  const [geoData, setGeoData] = useState(null);

  // Fetch data dari API FastAPI
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/geojson')
      .then(res => {
        setGeoData(res.data);
      })
      .catch(err => console.error("Gagal ambil data:", err));
  }, []);

  
  const onEachFeature = (feature, layer) => {
  if (feature.properties && feature.properties.alamat) {
    layer.bindPopup(`<b>Alamat:</b> ${feature.properties.alamat}`);
  }

  layer.on({
    mouseover: (e) => {
      const target = e.target;
      
      if (typeof target.setStyle === 'function') {
        target.setStyle({ fillOpacity: 0.7, weight: 3, color: 'yellow' });
      }
    },
    mouseout: (e) => {
      const target = e.target;
      if (typeof target.setStyle === 'function') {
        target.setStyle({ fillOpacity: 0.2, weight: 2, color: '#3388ff' });
      }
    }
  });
};

  return (
    <MapContainer 
      center={[-5.34, 105.31]} 
      zoom={13} 
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      
      {geoData && (
        <GeoJSON 
          data={geoData} 
          onEachFeature={onEachFeature}
          style={() => ({
            color: '#3388ff',
            weight: 2,
            fillOpacity: 0.2
          })}
        />
      )}
    </MapContainer>
  );
}

export default MapView;