"use client";

import { useEffect, useRef, useState } from "react";
import type { Facility, FacilityStatus } from "@/lib/engine/types";
import { darkMapStyle } from "@/lib/map-style";

const STATUS_VAR: Record<FacilityStatus, string> = {
  healthy: "var(--status-healthy)",
  at_risk: "var(--status-at-risk)",
  critical: "var(--status-critical)",
};

interface Props {
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface FacilityLayerLike extends google.maps.OverlayView {
  update(facilities: Facility[], selectedId: string | null, showLabels: boolean): void;
}

/** HTML markers on the map's overlay pane: full CSS control (glow, pulse).
    Defined in a factory because `google.maps.OverlayView` only exists after
    the Maps script has loaded — extending it at module scope would throw. */
function createFacilityLayer(onSelect: (id: string) => void): FacilityLayerLike {
  class FacilityLayer extends google.maps.OverlayView {
    private container = document.createElement("div");
    private markers = new Map<string, HTMLDivElement>();
    private positions = new Map<string, google.maps.LatLng>();
    private lastStatus = new Map<string, FacilityStatus>();

    constructor(private onSelect: (id: string) => void) {
      super();
      this.container.style.position = "absolute";
    }

  onAdd() {
    this.getPanes()!.overlayMouseTarget.appendChild(this.container);
  }

  onRemove() {
    this.container.remove();
  }

  update(facilities: Facility[], selectedId: string | null, showLabels: boolean) {
    for (const f of facilities) {
      let el = this.markers.get(f.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "hg-marker";
        el.style.cssText =
          "position:absolute;transform:translate(-50%,-50%);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;";
        el.innerHTML = `<div class="hg-dot" style="width:12px;height:12px;border-radius:50%;"></div><div class="hg-label rail-label" style="white-space:nowrap;"></div>`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onSelect(f.id);
        });
        this.container.appendChild(el);
        this.markers.set(f.id, el);
      }
      this.positions.set(f.id, new google.maps.LatLng(f.lat, f.lng));

      const color = STATUS_VAR[f.status];
      const dot = el.querySelector<HTMLDivElement>(".hg-dot")!;
      const selected = f.id === selectedId;
      dot.style.background = color;
      dot.style.color = color; // drives the pulse ring via currentColor
      dot.style.boxShadow = `0 0 ${f.status === "healthy" ? 6 : 14}px 1px ${color}${selected ? ", 0 0 0 2px var(--ink-1)" : ""}`;
      el.style.zIndex = selected ? "30" : f.status === "critical" ? "20" : "10";

      const label = el.querySelector<HTMLDivElement>(".hg-label")!;
      label.textContent = f.name;
      // Facilities in trouble always carry their name; the rest label on zoom.
      label.style.display = showLabels || selected || f.status !== "healthy" ? "block" : "none";
      label.style.color = selected ? "var(--ink-1)" : f.status === "critical" ? STATUS_VAR.critical : "var(--ink-3)";
      label.style.textShadow = "0 1px 3px rgba(0,0,0,0.9)";

      const prev = this.lastStatus.get(f.id);
      if (prev && prev !== f.status) {
        dot.classList.remove("pulse-once");
        void dot.offsetWidth; // restart the animation
        dot.classList.add("pulse-once");
      }
      this.lastStatus.set(f.id, f.status);
    }
    this.draw();
  }

    draw() {
      const proj = this.getProjection();
      if (!proj) return;
      for (const [id, el] of this.markers) {
        const pos = this.positions.get(id);
        if (!pos) continue;
        const pt = proj.fromLatLngToDivPixel(pos);
        if (pt) {
          el.style.left = `${pt.x}px`;
          el.style.top = `${pt.y}px`;
        }
      }
    }
  }
  return new FacilityLayer(onSelect);
}

export default function MapCanvas({ facilities, selectedId, onSelect }: Props) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const layer = useRef<FacilityLayerLike | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "no-key" | "error">(() =>
    process.env.NEXT_PUBLIC_MAPS_API_KEY ? "loading" : "no-key",
  );

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAPS_API_KEY;
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        setOptions({ key, v: "weekly" });
        const { Map } = await importLibrary("maps");
        if (cancelled || !mapDiv.current) return;
        const map = new Map(mapDiv.current, {
          center: { lat: 20.78, lng: 78.6 },
          zoom: 10,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: "#0a0e13",
        });
        layer.current = createFacilityLayer(onSelect);
        layer.current.setMap(map);
        map.addListener("zoom_changed", () => setShowLabels((map.getZoom() ?? 10) >= 11));
        setState("ready");
      } catch {
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // onSelect is stable from the page; map must init exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layer.current?.update(facilities, selectedId, showLabels);
  }, [facilities, selectedId, showLabels, state]);

  if (state === "no-key" || state === "error") {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface-1 border border-line rounded p-3">
        <div className="rail-label mb-2">
          {state === "no-key" ? "Facilities (map pending Maps API key)" : "Facilities (map failed to load)"}
        </div>
        <ul className="space-y-1">
          {facilities.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => onSelect(f.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-surface-2 ${
                  f.id === selectedId ? "bg-surface-2" : ""
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: STATUS_VAR[f.status], boxShadow: `0 0 6px ${STATUS_VAR[f.status]}` }}
                />
                <span className="text-ink-1">{f.name}</span>
                <span className="num ml-auto text-ink-3">{f.healthScore}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <div ref={mapDiv} className="flex-1 min-h-0 rounded border border-line" />;
}
