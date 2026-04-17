from pydantic import BaseModel

# Pastikan namanya 'LocationCreate' sama persis dengan yang di main.py
class LocationCreate(BaseModel):
    name: str
    lat: float
    lon: float

# Pastikan namanya 'LocationResponse' juga ada
class LocationResponse(BaseModel):
    id: int
    name: str
    lat: float
    lon: float

    class Config:
        from_attributes = True