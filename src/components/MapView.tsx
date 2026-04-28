import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Agent } from "../types";

const dotIcon = L.divIcon({
  className: "dot-marker",
  html: '<span class="dot"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FlyTo({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom ?? 12, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

type Props = {
  agents: Agent[];
  selectedId: string | null;
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  onSelect: (a: Agent) => void;
};

export function MapView({ agents, selectedId, flyTarget, onSelect }: Props) {
  return (
    <div className="map-wrap">
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        scrollWheelZoom={true}
        worldCopyJump
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FlyTo target={flyTarget} />
        {agents.map((a) => (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={dotIcon}
            eventHandlers={{ click: () => onSelect(a) }}
            opacity={selectedId === null || selectedId === a.id ? 1 : 0.55}
          />
        ))}
      </MapContainer>
    </div>
  );
}
