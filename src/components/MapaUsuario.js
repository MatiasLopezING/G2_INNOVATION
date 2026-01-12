import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getEstadoFarmacia } from '../utils/horariosUtils';
import { cn } from '../lib/utils';

/**
 * Componente para mostrar el mapa del usuario, farmacias y deliverys.
 * Props:
 *   - usuario: objeto con datos del usuario
 *   - farmacias: array de farmacias
 *   - deliverys: array de deliverys (opcional)
 */

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
const farmaciaIconHighlighted = L.icon({
  iconUrl: process.env.PUBLIC_URL + "/icons/farmacia.png",
  iconSize: [44, 44],
  iconAnchor: [22, 44],
  popupAnchor: [0, -44]
});
const deliveryIcon = L.icon({
  iconUrl: process.env.PUBLIC_URL + "/icons/delivery.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

function MapaUsuario({
  usuario,
  farmacias,
  deliverys = [],
  highlightedFarmaciaId = null,
  onHoverFarmaciaId,
  className,
}) {
  if (!usuario?.latitud || !usuario?.longitud) {
    return (
      <div className={cn('h-full w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600', className)}>
        No se encontró ubicación del usuario.
      </div>
    );
  }

  const position = [Number(usuario.latitud), Number(usuario.longitud)];

  return (
    <div className={cn('h-full w-full', className)}>
      <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={usuarioIcon}>
          <Popup>Tu ubicación</Popup>
        </Marker>
        {farmacias.map((farmacia) => {
          if (!farmacia.latitud || !farmacia.longitud) return null;
          
          const estado = getEstadoFarmacia(farmacia.horarios);
          const active = highlightedFarmaciaId && String(highlightedFarmaciaId) === String(farmacia.id);
          
          return (
            <Marker
              key={farmacia.id}
              position={[Number(farmacia.latitud), Number(farmacia.longitud)]}
              icon={active ? farmaciaIconHighlighted : farmaciaIcon}
              eventHandlers={{
                mouseover: () => onHoverFarmaciaId && onHoverFarmaciaId(farmacia.id),
                mouseout: () => onHoverFarmaciaId && onHoverFarmaciaId(null),
              }}
            >
              <Popup>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
                    {farmacia.nombreFarmacia || farmacia.id}
                  </h4>
                  <p style={{ margin: '4px 0', fontSize: '14px' }}>
                    <strong>Estado:</strong> 
                    <span style={{ 
                      color: estado.abierta ? '#28a745' : '#dc3545',
                      marginLeft: '4px'
                    }}>
                      {estado.mensaje}
                    </span>
                  </p>
                  {farmacia.contactoFarmacia && (
                    <p style={{ margin: '4px 0', fontSize: '14px' }}>
                      <strong>Contacto:</strong> {farmacia.contactoFarmacia}
                    </p>
                  )}
                  {!estado.abierta && estado.proximaApertura && (
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}>
                      <strong>Próxima apertura:</strong> {estado.proximaApertura}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
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
