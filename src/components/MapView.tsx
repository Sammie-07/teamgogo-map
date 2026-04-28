import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import type { LatLngBounds, LatLngBoundsExpression } from "leaflet";
import type { Agent } from "../types";
import { regionStats, densityRadius } from "../utils/coverage";

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

const pulseIcon = L.divIcon({
  className: "pulse-marker",
  html: '<span class="pulse-ring"></span><span class="pulse-dot"></span>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const userIcon = L.divIcon({
  className: "user-marker",
  html: '<span class="user-ring"></span><span class="user-dot"></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

type Props = {
  agents: Agent[];
  selected: Agent | null;
  flyTarget: { lat: number; lng: number; zoom?: number } | null;
  onSelect: (a: Agent) => void;
  maxBounds: LatLngBoundsExpression | null;
  initialView: { center: [number, number]; zoom: number };
  showDensity: boolean;
  userLocation: { lat: number; lng: number } | null;
  darkMode: boolean;
};

const LABEL_FADE_START = 9;
const LABEL_FADE_END = 11.5;

export function MapView({
  agents,
  selected,
  flyTarget,
  onSelect,
  maxBounds,
  initialView,
  showDensity,
  userLocation,
  darkMode,
}: Props) {
  const [mapState, setMapState] = useState<MapState>({ zoom: initialView.zoom, bounds: null });

  const labelOpacity = Math.max(
    0,
    Math.min(1, (mapState.zoom - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START))
  );

  const tileUrl = darkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const stats = showDensity ? regionStats(agents) : [];

  return (
    <div className="map-wrap">
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        scrollWheelZoom
        minZoom={3}
        maxZoom={18}
        maxBounds={maxBounds ?? undefined}
        maxBoundsViscosity={0.9}
        preferCanvas
        worldCopyJump={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
          noWrap
        />
        <FlyTo target={flyTarget} />
        <MapStateTracker onChange={setMapState} />

        {/* Density overlay — translucent circles per state, sized by agent count */}
        {showDensity &&
          stats.map((s) => (
            <Circle
              key={s.key}
              center={[s.lat, s.lng]}
              radius={densityRadius(s.count) * 4000}
              pathOptions={{
                color: "#d94f3b",
                fillColor: "#d94f3b",
                fillOpacity: 0.18,
                weight: 1,
              }}
              interactive={false}
            />
          ))}

        {/* Pulsing ring under the selected pin */}
        {selected && (
          <Marker
            position={[selected.lat, selected.lng]}
            icon={pulseIcon}
            interactive={false}
            keyboard={false}
            zIndexOffset={-1000}
          />
        )}

        {/* User location marker */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        {/* All agents */}
        {agents.map((a) => {
          const isSelected = selected?.id === a.id;
          const isFaded = selected !== null && !isSelected;
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
              fillOpacity={isFaded ? 0.35 : 0.95}
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
