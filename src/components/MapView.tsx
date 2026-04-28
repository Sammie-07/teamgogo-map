import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useState } from "react";
import type { Agent } from "../types";

// Fix default marker icon paths (Leaflet's default assets break under bundlers)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

function PopupBody({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false);
  const loc = [agent.city, agent.state, agent.country].filter(Boolean).join(", ");
  return (
    <div className="popup-card">
      <h3>{agent.name}</h3>
      <div className="loc">{loc}</div>
      {!open ? (
        <button className="contact-btn" onClick={() => setOpen(true)}>
          Show contact
        </button>
      ) : (
        <div className="contact">
          {agent.email && <a href={`mailto:${agent.email}`}>{agent.email}</a>}
          {agent.phone && <a href={`tel:${agent.phone.replace(/[^0-9+]/g, "")}`}>{agent.phone}</a>}
        </div>
      )}
    </div>
  );
}

export function MapView({ agents }: { agents: Agent[] }) {
  return (
    <div className="map-wrap">
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        scrollWheelZoom={true}
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {agents.map((a) => (
          <Marker key={a.id} position={[a.lat, a.lng]}>
            <Popup>
              <PopupBody agent={a} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
