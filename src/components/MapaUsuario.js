
import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const usuarioIcon = L.icon({
  iconUrl: process.env.PUBLIC_URL + "/icons/usuario.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});
const farmaciaIcon = L.icon({
  iconUrl: process.env.PUBLIC_URL + "/icons/farmacia.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});
const deliveryIcon = L.icon({
  iconUrl: process.env.PUBLIC_URL + "/icons/delivery.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

function MapaUsuario({ usuario, farmacias, deliverys = [] }) {
  if (!usuario?.latitud || !usuario?.longitud) {
    return <div>No se encontró ubicación del usuario.</div>;
  }

  const position = [Number(usuario.latitud), Number(usuario.longitud)];

  return (
    <div style={{ height: "400px", width: "100%", marginBottom: "20px" }}>
      <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={usuarioIcon}>
          <Popup>Tu ubicación</Popup>
        </Marker>
        {farmacias.map((farmacia) => (
          farmacia.latitud && farmacia.longitud ? (
            <Marker key={farmacia.id} position={[Number(farmacia.latitud), Number(farmacia.longitud)]} icon={farmaciaIcon}>
              <Popup>{farmacia.nombreFarmacia || farmacia.id}</Popup>
            </Marker>
          ) : null
        ))}
        {deliverys.map((delivery) => (
          delivery.latitud && delivery.longitud ? (
            <Marker key={delivery.id} position={[Number(delivery.latitud), Number(delivery.longitud)]} icon={deliveryIcon}>
              <Popup>{delivery.nombre || delivery.id}</Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

export default MapaUsuario;
