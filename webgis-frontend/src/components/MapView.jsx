import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

function MapView() {
  const [geoData, setGeoData] = useState(null);
  const [formData, setFormData] = useState({ name: '', lat: '', lon: '' });
  
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  // --- TAMBAHAN: State untuk cek status login ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 1. Tambahkan state baru di dalam fungsi MapView()
  const [aiDetectionData, setAiDetectionData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

// 2. Buat fungsi untuk menembak API YOLOv8
  const handleAiDetection = async () => {
    setLoadingAi(true); // Nyalakan loading animasi tombol
    try {
      alert("Memulai deteksi objek dengan YOLOv8, mohon tunggu...");
      const res = await axios.get('http://127.0.0.1:8000/detect-satelite');
      setAiDetectionData(res.data);
      alert(`Sukses! Berhasil mendeteksi ${res.data.features.length} objek.`);
    } catch (err) {
      alert("Gagal menjalankan deteksi AI. Pastikan file citra satelit ada di backend dan server menyala.");
    } finally {
      setLoadingAi(false); // Matikan loading animasi tombol
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/geojson');
      setGeoData(res.data);
    } catch (err) {
      console.error("Gagal ambil data:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const params = new URLSearchParams();
      params.append('username', loginData.username);
      params.append('password', loginData.password);

      await axios.post('http://127.0.0.1:8000/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      alert("Login Berhasil!");
      // --- TAMBAHAN: Set status login jadi true ---
      setIsLoggedIn(true); 
      setShowLogin(false);
    } catch (err) {
      alert("Username atau Password Salah!");
    }
  };

  const handleDelete = async (alamat) => {
    if (window.confirm(`Yakin ingin menghapus: ${alamat}?`)) {
      try {
        await axios.delete(`http://127.0.0.1:8000/locations/${alamat}`);
        alert("Terhapus!");
        fetchData(); 
      } catch (err) {
        alert("Gagal hapus!");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        lat: parseFloat(formData.lat),
        lon: parseFloat(formData.lon)
      };
      await axios.post('http://127.0.0.1:8000/locations', payload);
      alert("Berhasil ditambah!");
      setFormData({ name: '', lat: '', lon: '' });
      fetchData(); 
    } catch (err) {
      alert("Gagal tambah data!");
    }
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties && feature.properties.alamat) {
      // --- MODIFIKASI: Tombol hapus cuma muncul di popup kalau isLoggedIn true ---
      const popupContent = `
        <div style="text-align:center;">
          <b>Alamat:</b> ${feature.properties.alamat}<br/>
          ${isLoggedIn ? `
            <button id="btn-del-${feature.properties.alamat}" 
              style="background:red; color:white; border:none; cursor:pointer; margin-top:10px; padding:5px 10px; border-radius:4px;">
              Hapus Titik
            </button>
          ` : '<i>Login untuk menghapus</i>'}
        </div>
      `;
      layer.bindPopup(popupContent);
      
      layer.on('popupopen', () => {
        const btn = document.getElementById(`btn-del-${feature.properties.alamat}`);
        if(btn) btn.onclick = () => handleDelete(feature.properties.alamat);
      });
    }

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, color: 'yellow' }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.2, color: '#3388ff' })
    });
  };

  return (
    <div style={{ padding: '20px', position: 'relative', fontFamily: 'Arial' }}>
      
      
      <button 
        onClick={isLoggedIn ? () => setIsLoggedIn(false) : () => setShowLogin(true)}
        style={{ position: 'absolute', top: 20, right: 20, padding: '10px 20px', cursor: 'pointer', background: isLoggedIn ? '#d32f2f' : '#333', color: 'white', borderRadius: '5px', border: 'none', zIndex: 1000 }}
      >
        {isLoggedIn ? "Logout Admin" : "Login Admin"}
      </button>

      <h2 style={{ textAlign: 'center' }}>WebGIS Bandar Lampung - Tugas 9</h2>
      <p style={{ textAlign: 'center', marginTop: '0', color: '#555' }}>Integrasi Deep Learning YOLOv8 & Sistem Informasi Geografis</p>

      
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '15px' }}>
        <button 
          onClick={handleAiDetection} 
          disabled={loadingAi}
          style={{ background: '#007bff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loadingAi ? "⏳ Sedikit Lagi Memproses AI..." : "🤖 Jalankan Pipeline YOLOv8"}
        </button>
      </div>

      {showLogin && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', width: '300px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0 }}>Admin Login</h3>
            <form onSubmit={handleLogin}>
              <input style={{ width: '100%', marginBottom: '15px', padding: '8px', boxSizing: 'border-box' }} 
                type="text" placeholder="Username" required
                onChange={e => setLoginData({...loginData, username: e.target.value})} 
              />
              <input style={{ width: '100%', marginBottom: '15px', padding: '8px', boxSizing: 'border-box' }} 
                type="password" placeholder="Password" required
                onChange={e => setLoginData({...loginData, password: e.target.value})} 
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ flex: 1, background: '#28a745', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Masuk</button>
                <button type="button" onClick={() => setShowLogin(false)} style={{ flex: 1, background: '#dc3545', color: 'white', padding: '10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

    
      {isLoggedIn ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center', background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
          <input style={{ padding: '8px' }} type="text" placeholder="Nama Lokasi" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input style={{ padding: '8px' }} type="number" step="any" placeholder="Lat" value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} required />
          <input style={{ padding: '8px' }} type="number" step="any" placeholder="Lon" value={formData.lon} onChange={e => setFormData({...formData, lon: e.target.value})} required />
          <button type="submit" style={{ background: 'green', color: 'white', padding: '8px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Tambah Titik</button>
        </form>
      ) : (
        <p style={{ textAlign: 'center', color: '#666' }}>Silakan login untuk menambah atau menghapus data.</p>
      )}  

      <MapContainer center={[-5.397, 105.266]} zoom={13} style={{ height: '70vh', width: '100%', borderRadius: '10px', border: '2px solid #ddd' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        
        {geoData && (
          <GeoJSON 
            key={isLoggedIn ? 'admin-mode' : 'public-mode'} 
            data={geoData} 
            onEachFeature={onEachFeature} 
          />
        )}
        {aiDetectionData && (
          <GeoJSON 
            data={aiDetectionData} 
            pointToLayer={(feature, latlng) => {
             
              return L.circleMarker(latlng, { radius: 8, fillColor: "red", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8 });
            }}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`<b>Objek AI:</b> ${feature.properties.class_name}<br/><b>Akurasi:</b> ${feature.properties.confidence * 100}%`);
            }}
          />
        )}
      </MapContainer>

    </div>
  );
}

export default MapView;