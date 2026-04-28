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
import type { LatLngBounds, LatLngBoundsExpression, Map as LMap } from "leaflet";
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

const LABEL_FADE_START = 10;
const LABEL_FADE_END = 12;

/**
 * Greedy non-overlap label placement. Project each agent's lat/lng to
 * pixels, then place labels in priority order (selected first, then top
 * to bottom) skipping any that would collide with an already-placed
 * label's bounding box. Result: at most one label per ~140px×26px area.
 */
function pickVisibleLabels(
  map: LMap,
  agents: Agent[],
  selectedId: string | null
): Set<string> {
  const visible = new Set<string>();
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const PAD = 6;

  const sorted = [...agents].sort((a, b) => {
    if (a.id === selectedId) return -1;
    if (b.id === selectedId) return 1;
    // Influencer agents next
    if (a.influencer && !b.influencer) return -1;
    if (!a.influencer && b.influencer) return 1;
    // Then top-to-bottom for stability
    return b.lat - a.lat;
  });

  for (const a of sorted) {
    const pt = map.latLngToContainerPoint([a.lat, a.lng]);
    const labelW = Math.min(180, 60 + a.name.length * 6.2);
    const box = {
      x: pt.x + 10,            // label is to the right of the pin
      y: pt.y - 12,            // vertically centered on pin
      w: labelW,
      h: 22,
    };
    let conflict = false;
    for (const p of placed) {
      if (
        box.x < p.x + p.w + PAD &&
        box.x + box.w + PAD > p.x &&
        box.y < p.y + p.h + PAD &&
        box.y + box.h + PAD > p.y
      ) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      visible.add(a.id);
      placed.push(box);
    }
  }
  return visible;
}

type MapState = {
  zoom: number;
  bounds: LatLngBounds | null;
  labelOpacity: number;
  visibleLabels: Set<string>;
};

function MapStateTracker({
  agents,
  selectedId,
  onChange,
}: {
  agents: Agent[];
  selectedId: string | null;
  onChange: (s: MapState) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const labelOpacity = Math.max(
        0,
        Math.min(1, (zoom - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START))
      );
      let visibleLabels: Set<string> = new Set();
      if (labelOpacity > 0) {
        const inView = agents.filter((a) => bounds.contains([a.lat, a.lng]));
        visibleLabels = pickVisibleLabels(map, inView, selectedId);
      }
      onChange({ zoom, bounds, labelOpacity, visibleLabels });
    };
    update();
    map.on("zoomend", update);
    map.on("moveend", update);
    return () => {
      map.off("zoomend", update);
      map.off("moveend", update);
    };
  }, [map, agents, selectedId, onChange]);
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
  const [mapState, setMapState] = useState<MapState>({
    zoom: initialView.zoom,
    bounds: null,
    labelOpacity: 0,
    visibleLabels: new Set(),
  });

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
        <MapStateTracker
          agents={agents}
          selectedId={selected?.id ?? null}
          onChange={setMapState}
        />

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

        {selected && (
          <Marker
            position={[selected.lat, selected.lng]}
            icon={pulseIcon}
            interactive={false}
            keyboard={false}
            zIndexOffset={-1000}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        {agents.map((a) => {
          const isSelected = selected?.id === a.id;
          const isFaded = selected !== null && !isSelected;
          const showLabel = mapState.visibleLabels.has(a.id);
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
                  offset={[10, 0]}
                  opacity={mapState.labelOpacity}
                  className={`agent-label${isSelected ? " selected" : ""}`}
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
