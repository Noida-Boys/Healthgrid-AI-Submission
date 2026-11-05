// Hand-tuned dark cartography matching DESIGN.md surfaces. POIs and transit
// are hidden: the district map is an instrument, not a consumer map.
export const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#10161d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5f7183" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e13" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a3644" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#7d8fa0" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b2530" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243040" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#5f7183" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1720" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#0f151c" }] },
];
