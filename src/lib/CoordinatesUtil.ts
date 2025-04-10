export const formatCoordinates = (latLng: { lat: number; lng: number }) => {
    const formattedLat = `${latLng.lat.toFixed(2)}° ${latLng.lat >= 0 ? 'N' : 'S'}`;
    const formattedLng = `${Math.abs(latLng.lng).toFixed(2)}° ${latLng.lng >= 0 ? 'E' : 'W'}`;
    
    return {
      lat: formattedLat,
      lng: formattedLng
    };
  };
  
  export const handleMapClick = (map: any, L: any, callback: (latLng: { lat: number; lng: number }) => void) => {
    map.on('click', (e: any) => {
      callback(e.latlng);
    });
  };
  