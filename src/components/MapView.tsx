import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Agent } from "../types";

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
        {agents.map((a) => {
          const isSelected = selectedId === a.id;
          const isFaded = selectedId !== null && !isSelected;
          return (
            <CircleMarker
              key={a.id}
              center={[a.lat, a.lng]}
              radius={isSelected ? 8 : 6}
              fillColor="#d94f3b"
              fillOpacity={isFaded ? 0.4 : 0.95}
              color="#ffffff"
              weight={2}
              opacity={isFaded ? 0.5 : 1}
              eventHandlers={{ click: () => onSelect(a) }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
