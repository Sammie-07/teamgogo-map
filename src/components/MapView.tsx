import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import { useEffect, useState } from "react";
import type { LatLngBounds } from "leaflet";
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

type MapState = { zoom: number; bounds: LatLngBounds | null };

function MapStateTracker({ onChange }: { onChange: (s: MapState) => void }) {
  const map = useMap();
  useEffect(() => {
    const update = () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() });
    update();
    map.on("zoomend", update);
    map.on("moveend", update);
    return () => {
      map.off("zoomend", update);
      map.off("moveend", update);
    };
  }, [map, onChange]);
  return null;
}

type Props = {
  agents: Agent[];
  selectedId: string | null;
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  onSelect: (a: Agent) => void;
};

// Fade labels from 0 → 1 between these zoom levels
const LABEL_FADE_START = 9;
const LABEL_FADE_END = 11.5;

export function MapView({ agents, selectedId, flyTarget, onSelect }: Props) {
  const [mapState, setMapState] = useState<MapState>({ zoom: 4, bounds: null });

  const labelOpacity = Math.max(
    0,
    Math.min(1, (mapState.zoom - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START))
  );

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
        <MapStateTracker onChange={setMapState} />
        {agents.map((a) => {
          const isSelected = selectedId === a.id;
          const isFaded = selectedId !== null && !isSelected;
          const showLabel =
            labelOpacity > 0 &&
            mapState.bounds !== null &&
            mapState.bounds.contains([a.lat, a.lng]);
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
            >
              {showLabel && (
                <Tooltip
                  permanent
                  direction="right"
                  offset={[8, 0]}
                  opacity={labelOpacity}
                  className="agent-label"
                >
                  {a.name}
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
