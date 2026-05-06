import rasterio
from rasterio.warp import transform  # Ini tetap, tapi cara pakenya di bawah gue benerin
from ultralytics import YOLO
import json
import numpy as np

def run_yolo_gis_pipeline(image_path, output_geojson_path):
    # Load model YOLOv8
    model = YOLO("yolov8n.pt") 
    features = []
    
    try:
        with rasterio.open(image_path) as src:
            width = src.width
            height = src.height
            crs = src.crs 
            
            # Ukuran tile
            tile_size = 640 
            
            # --- 1. PROSES TILING LOOP ---
            for y in range(0, height, tile_size):
                for x in range(0, width, tile_size):
                    window = rasterio.windows.Window(x, y, min(tile_size, width - x), min(tile_size, height - y))
                    
                    num_bands = src.count
                    if num_bands >= 3:
                        
                        tile_data = src.read([1, 2, 3], window=window)
                    else:
                        # Jika hanya 1 band, baca band 1 lalu tumpuk 3 kali supaya jadi format RGB
                        single_band = src.read(1, window=window)
                        tile_data = np.stack([single_band, single_band, single_band])
                    
                    if tile_data.size == 0: continue
                    
                    # Ubah format array dari (Band, H, W) jadi (H, W, Band)
                    tile_img = np.moveaxis(tile_data, 0, -1)
                    
                    # --- 2. DETEKSI DENGAN YOLOV8 ---
                    results = model(tile_img, verbose=False)
                    
                    for result in results:
                        for box in result.boxes:
                            x1_t, y1_t, x2_t, y2_t = box.xyxy[0].tolist()
                            conf = float(box.conf[0])
                            cls = int(box.cls[0])
                            
                            if conf < 0.3: continue 
                            
                            # Koordinat piksel global
                            center_x_g = x + (x1_t + x2_t) / 2
                            center_y_g = y + (y1_t + y2_t) / 2
                            
                            # --- 3. KONVERSI PIKSEL KE KOORDINAT BUMI ---
                            # posX dan posY adalah koordinat dalam sistem CRS asli (misal: UTM atau lainnya)
                            posX, posY = src.xy(center_y_g, center_x_g)
                            
                            # PERBAIKAN DI SINI: Cara pakai transform yang benar
                            # Kita ubah dari CRS asli citra ke WGS84 (Lat/Lon)
                            longitudes, latitudes = transform(src.crs, 'EPSG:4326', [posX], [posY])
                            
                            lon = longitudes[0]
                            lat = latitudes[0]
                            
                            features.append({
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [lon, lat]
                                },
                                "properties": {
                                    "class_name": model.names[cls],
                                    "confidence": round(conf, 2)
                                }
                            })
                            
        # --- 5. EXPORT KE FILE GEOJSON ---
        geojson_result = {
            "type": "FeatureCollection",
            "features": features
        }
        
        with open(output_geojson_path, "w") as f:
            json.dump(geojson_result, f)
            
        return geojson_result

    except Exception as e:
        print(f"Error di Pipeline: {e}")
        raise e