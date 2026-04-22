from fastapi import FastAPI, HTTPException, Depends
import psycopg2
from psycopg2.extras import RealDictCursor
from schemas import LocationCreate, LocationResponse
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from datetime import datetime, timedelta
from decimal import Decimal

app = FastAPI(title="Tugas 9 - API Spasial ITERA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
SECRET_KEY = "itera_informatika_2026"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    if form_data.username == "admin" and form_data.password == "admin123":
        access_token = jwt.encode({"sub": form_data.username}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="User atau Password salah")

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="sig_123140127", 
            user="postgres",                # <--- GANTI INI (biasanya postgres)
            password="Asep",       # <--- GANTI INI
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Error koneksi ke database: {e}")
        return None

@app.get("/")
def home():
    return {"status": "Aman!", "pesan": "API sudah siap digunakan"}


@app.get("/locations", response_model=List[LocationResponse])
def get_all_locations():
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    cur = conn.cursor()
    
    query = """
        SELECT 
            ctid as id, 
            alamat as name, 
            ST_X(geom) as lon, 
            ST_Y(geom) as lat 
        FROM fasilitas_publik
    """
    cur.execute(query)
    data = cur.fetchall()
    
    
    formatted_data = []
    for index, row in enumerate(data):
        formatted_data.append({
            "id": index + 1,
            "name": row['name'],
            "lon": row['lon'],
            "lat": row['lat']
        })
        
    cur.close()
    conn.close()
    return formatted_data


@app.get("/geojson")
def get_geojson():
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    cur = conn.cursor()
    query = """
    SELECT jsonb_build_object(
        'type',     'FeatureCollection',
        'features', jsonb_agg(features.feature)
    )
    FROM (
      SELECT jsonb_build_object(
        'type',       'Feature',
        'geometry',   ST_AsGeoJSON(geom)::jsonb,
        'properties', jsonb_build_object('alamat', alamat)
      ) AS feature
      FROM fasilitas_publik
    ) AS features;
    """
    try:
        cur.execute(query)
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['jsonb_build_object']
    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error GeoJSON: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

from decimal import Decimal

@app.post("/locations")
def add_location(loc: LocationCreate):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Gagal koneksi database")
    
    cur = conn.cursor()
    query = """
        INSERT INTO fasilitas_publik (nama, alamat, jenis, geom) 
        VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
    """
    try:
        jenis_default = "Umum"
        long = float(loc.lon)
        lati = float(loc.lat)
        
        cur.execute(query, (loc.name, loc.name, jenis_default, long, lati))
        conn.commit()
        return {"message": "Data berhasil ditambah!"}
    except Exception as e:
        conn.rollback()
        print(f"DEBUG ERROR SQL: {e}") 
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/locations/{alamat}")
def delete_location(alamat: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM fasilitas_publik WHERE alamat = %s", (alamat,))
    conn.commit()
    count = cur.rowcount
    cur.close()
    conn.close()
    if count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return {"message": f"Fasilitas {alamat} berhasil dihapus!"}

@app.put("/locations/{old_alamat}")
def update_location(old_alamat: str, loc: LocationCreate):
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
        UPDATE fasilitas_publik 
        SET alamat = %s, geom = ST_SetSRID(ST_MakePoint(%s, %s), 4326)
        WHERE alamat = %s
    """
    cur.execute(query, (loc.name, loc.lon, loc.lat, old_alamat))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Data berhasil diperbarui!"}

@app.get("/nearby")
def get_nearby_locations(lat: float, lon: float, radius: int = 5000):
    conn = get_db_connection()
    cur = conn.cursor()
    # Ganti 'name' jadi 'alamat'
    query = """
    SELECT alamat as name, ST_Distance(geom::geography, ST_MakePoint(%s, %s)::geography) as jarak_meter
    FROM fasilitas_publik
    WHERE ST_DWithin(geom::geography, ST_MakePoint(%s, %s)::geography, %s)
    ORDER BY jarak_meter ASC
    """
    cur.execute(query, (lon, lat, lon, lat, radius))
    data = cur.fetchall()
    cur.close()
    conn.close()
    return data

@app.get("/locations/{loc_id}", response_model=LocationResponse)
def get_location_by_id(loc_id: int):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    cur = conn.cursor()
    
    query = """
        SELECT 
            alamat as name, 
            ST_X(geom) as lon, 
            ST_Y(geom) as lat 
        FROM fasilitas_publik 
        WHERE ctid = (SELECT ctid FROM fasilitas_publik LIMIT 1 OFFSET %s)
    """
    
    try:
        # Kita kurangi 1 karena index di API mulai dari 1, tapi OFFSET mulai dari 0
        cur.execute(query, (loc_id - 1,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if row:
            return {
                "id": loc_id,
                "name": row['name'],
                "lon": row['lon'],
                "lat": row['lat']
            }
        else:
            raise HTTPException(status_code=404, detail="Lokasi tidak ditemukan")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))