// Dashboard page for users to view and book nearby parking lots
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import "./Dashboard.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fallback coordinates near seeded demo data (Ahmedabad)
const DEFAULT_COORDS = { latitude: 23.0512, longitude: 72.6677 };

export default function Dashboard() {
  // State variables for parking lots, loading, errors, booking, and UI
  const [parkingLots, setParkingLots] = useState([]); // List of nearby parking lots
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(""); // Error message
  const [selectedLot, setSelectedLot] = useState(null); // Currently selected lot for booking
  const [bookingHour, setBookingHour] = useState(""); // Hour input for booking
  const [bookingMsg, setBookingMsg] = useState(""); // Booking status message
  const [bookingLoading, setBookingLoading] = useState(false); // Booking loading state
  const [flippedId, setFlippedId] = useState(null); // ID of card currently flipped
  const [expand, setExpand] = useState(null); // Expanding popup state
  const [notice, setNotice] = useState(""); // Non-blocking info message
  const [query, setQuery] = useState(""); // search query text
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const currentCoordsRef = useRef(DEFAULT_COORDS);
  const userMarkerRef = useRef(null);
  const parkingIconRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const searchIconRef = useRef(null);
  const manualCenterRef = useRef(false);

  // Build a Nominatim search URL with optional map bias
  const buildSearchUrl = useCallback((text, limit = 1) => {
    const map = mapInstanceRef.current;
    let base = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(
      text
    )}`;
    if (map) {
      try {
        const b = map.getBounds();
        const south = b.getSouth();
        const west = b.getWest();
        const north = b.getNorth();
        const east = b.getEast();
        base += `&viewbox=${west},${north},${east},${south}&bounded=1`;
      } catch (e) {
        void e;
      }
    }
    return base;
  }, []);

  // Query backend for parking lot suggestions by name/address
  const fetchLotSuggestions = useCallback(async (text, limit = 5) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/parkinglots/search`, {
        params: { q: text },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const lots = Array.isArray(res.data?.parkingLots)
        ? res.data.parkingLots.slice(0, limit)
        : [];
      // Map to a unified suggestion shape
      return lots.map((lot) => ({
        type: "lot",
        lot,
        display_name:
          lot.name +
          (lot.address?.city ? `, ${lot.address.city}` : "") +
          (lot.address?.state ? `, ${lot.address.state}` : ""),
        lat: lot.location?.coordinates?.[1],
        lon: lot.location?.coordinates?.[0],
        place_id: lot._id,
      }));
    } catch {
      return [];
    }
  }, []);

  // Helpers (used by effects/UI below)
  function getOccupancyRatio(lot) {
    const t = Number(lot.totalSlots) || 1;
    const a = Math.max(0, Number(lot.availableSlots) || 0);
    const used = Math.max(0, t - a);
    return Math.max(0, Math.min(1, used / t));
  }
  const barClassForRatio = useCallback(function barClassForRatio(r) {
    if (r === 0) return "bar-green";
    if (r < 0.15) return "bar-lightgreen";
    if (r < 0.3) return "bar-lime";
    if (r < 0.5) return "bar-yellow";
    if (r < 0.65) return "bar-amber";
    if (r < 0.8) return "bar-orange";
    if (r < 0.95) return "bar-red";
    return "bar-darkred";
  }, []);
  // colorForRatio no longer needed for map markers (pins are uniform)
  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (s) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[s])
    );
  }

  // Fetch nearby parking lots from backend using user's coordinates
  const fetchParkingLots = useCallback(async (coords) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/parkinglots`, {
        params: { lat: coords.latitude, lng: coords.longitude },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setParkingLots(res.data.parkingLots || []);
      setLastUpdated(new Date());
      currentCoordsRef.current = coords;
      // Update the user marker position on map
      try {
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([coords.latitude, coords.longitude]);
        }
      } catch (e) {
        void e;
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Could not fetch parking lots.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ask for user's location and load parking lots
  const askLocationAndLoad = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNotice(
        "Using default location (Ahmedabad) due to no geolocation support."
      );
      fetchParkingLots(DEFAULT_COORDS);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { latitude, longitude };
        fetchParkingLots(coords);
      },
      () => {
        setNotice(
          "Using default location (Ahmedabad) due to location access being denied."
        );
        fetchParkingLots(DEFAULT_COORDS);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [fetchParkingLots]);

  // On mount, ask for location and load lots
  useEffect(() => {
    askLocationAndLoad();
  }, [askLocationAndLoad]);

  // Auto refresh at intervals
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchParkingLots(currentCoordsRef.current);
    }, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchParkingLots]);

  // Initialize map once
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return;
    const map = L.map(mapRef.current).setView(
      [DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude],
      14
    );
    // Use satellite basemap (Esri World Imagery)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and others",
        maxZoom: 19,
      }
    ).addTo(map);

    // Create a drop/pin SVG icon for parking spots (bundler-safe)
    const pinSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">' +
      '<path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 22 12.5 41 12.5 41S25 22 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ea4335"/>' +
      '<circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>';
    const pinUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      pinSvg
    )}`;
    parkingIconRef.current = L.icon({
      iconUrl: pinUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: markerShadow,
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
    // A distinct icon for searched location (blue)
    const pinSvgBlue =
      '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">' +
      '<path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 22 12.5 41 12.5 41S25 22 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#2563eb"/>' +
      '<circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>';
    const pinUrlBlue = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      pinSvgBlue
    )}`;
    searchIconRef.current = L.icon({
      iconUrl: pinUrlBlue,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: markerShadow,
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
    const layer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = layer;
    // Add current user marker as a circular marker (updated on location fetch)
    const um = L.circleMarker(
      [DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude],
      {
        radius: 8,
        color: "#2563eb", // blue border
        weight: 2,
        fillColor: "#60a5fa", // light blue fill
        fillOpacity: 0.9,
      }
    ).addTo(map);
    um.bindPopup("You are here");
    userMarkerRef.current = um;
  }, []);

  // Update markers whenever parkingLots change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const markers = [];
    parkingLots.forEach((lot) => {
      const lat = lot.location?.coordinates?.[1];
      const lng = lot.location?.coordinates?.[0];
      if (lat == null || lng == null) return;
      // Use explicit pin icon for parking spots (drop marker)
      const marker = L.marker([lat, lng], {
        icon: parkingIconRef.current || undefined,
      }).addTo(layer);
      marker.bindPopup(
        `<strong>${escapeHtml(lot.name || "Unnamed")}</strong><br/>` +
          `${formatDistance(lot.distance || 0)} • ` +
          `${lot.availableSlots}/${lot.totalSlots} slots`
      );
      marker.on("click", () => setSelectedLot(lot));
      markers.push(marker);
    });

    if (markers.length) {
      const group = L.featureGroup([
        ...markers,
        ...(userMarkerRef.current ? [userMarkerRef.current] : []),
      ]);
      try {
        // If user manually centered via search, keep their view; otherwise fit to markers
        if (!manualCenterRef.current) {
          map.fitBounds(group.getBounds().pad(0.2));
        }
      } catch (err) {
        void err;
      } finally {
        // Clear manual centering flag after first update cycle
        if (manualCenterRef.current) manualCenterRef.current = false;
      }
    }
  }, [parkingLots]);

  // Search by text using OpenStreetMap Nominatim
  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    try {
      setSearching(true);
      // 1) Try backend lot search first
      const lotSuggestions = await fetchLotSuggestions(q, 1);
      let coords = null;
      let centerLabel = null;
      if (lotSuggestions.length > 0) {
        const s = lotSuggestions[0];
        if (s.lat != null && s.lon != null) {
          coords = {
            latitude: parseFloat(s.lat),
            longitude: parseFloat(s.lon),
          };
          centerLabel = s.display_name;
          // optionally preselect the lot
          setSelectedLot(s.lot);
        }
      }
      // 2) If no lot match, fall back to geocoding
      if (!coords) {
        const url = buildSearchUrl(q, 1);
        const res = await fetch(url, {
          headers: { Accept: "application/json", "Accept-Language": "en" },
        });
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setError("No results for that location.");
          setSearching(false);
          return;
        }
        const best = data[0];
        coords = {
          latitude: parseFloat(best.lat),
          longitude: parseFloat(best.lon),
        };
        centerLabel = best.display_name || q;
      }
      setError("");
      setNotice(`Centered to: ${centerLabel || q}`);
      const map = mapInstanceRef.current;
      if (map) {
        manualCenterRef.current = true;
        map.setView([coords.latitude, coords.longitude], 16);
        // Drop or move a marker at the searched location for clarity
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setLatLng([
            coords.latitude,
            coords.longitude,
          ]);
        } else {
          searchMarkerRef.current = L.marker(
            [coords.latitude, coords.longitude],
            { icon: searchIconRef.current || undefined }
          )
            .addTo(map)
            .bindPopup("Searched location");
        }
      }
      await fetchParkingLots(coords);
      setSearching(false);
      setShowSuggestions(false);
    } catch (e) {
      setError("Location search failed. Please try again in a moment.");
      setSearching(false);
      void e;
    }
  }

  // Fetch suggestions as the user types (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const id = setTimeout(async () => {
      try {
        // Fetch both geo suggestions and lot suggestions, then merge
        const [geoData, lotData] = await Promise.all([
          (async () => {
            const url = buildSearchUrl(q, 5);
            const res = await fetch(url, {
              headers: { Accept: "application/json", "Accept-Language": "en" },
            });
            const data = await res.json();
            if (!Array.isArray(data)) return [];
            return data.map((g) => ({ ...g, type: "geo" }));
          })(),
          fetchLotSuggestions(q, 5),
        ]);
        const merged = [...lotData, ...geoData];
        setSuggestions(merged);
        setShowSuggestions(merged.length > 0);
      } catch (e) {
        setSuggestions([]);
        setShowSuggestions(false);
        void e;
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query, buildSearchUrl, fetchLotSuggestions]);

  // When a suggestion is clicked
  const pickSuggestion = useCallback(
    async (sug) => {
      try {
        const isLot = sug.type === "lot";
        const coords = {
          latitude: parseFloat(sug.lat),
          longitude: parseFloat(sug.lon),
        };
        setQuery(
          (isLot ? sug.display_name : sug.display_name) ||
            `${sug.lat}, ${sug.lon}`
        );
        setError("");
        setNotice(`Centered to: ${sug.display_name || "Selected"}`);
        const map = mapInstanceRef.current;
        if (map) {
          manualCenterRef.current = true;
          map.setView([coords.latitude, coords.longitude], 16);
          if (searchMarkerRef.current) {
            searchMarkerRef.current.setLatLng([
              coords.latitude,
              coords.longitude,
            ]);
          } else {
            searchMarkerRef.current = L.marker(
              [coords.latitude, coords.longitude],
              { icon: searchIconRef.current || undefined }
            )
              .addTo(map)
              .bindPopup("Searched location");
          }
        }
        if (isLot && sug.lot) setSelectedLot(sug.lot);
        await fetchParkingLots(coords);
        setShowSuggestions(false);
      } catch (e) {
        setError("Failed to center to the selected suggestion.");
        void e;
      }
    },
    [fetchParkingLots]
  );

  function useMyLocation() {
    askLocationAndLoad();
  }

  // Allow user to manually switch to demo location if nothing loads nearby
  function useDemoLocation() {
    setError("");
    setNotice("Using default location (Ahmedabad) for demo data.");
    fetchParkingLots(DEFAULT_COORDS);
  }

  // Lock body scroll and optionally blur background when popup is open
  // Lock body scroll when popup is open
  useEffect(() => {
    if (expand) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [expand]);

  // Helper to format distance in meters/kilometers
  // Format distance in meters or kilometers
  function formatDistance(m) {
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(2)} km`;
  }

  // Availability status without numbers
  // Get availability status and color class for a parking lot
  function getAvailabilityStatus(lot) {
    const a = Number(lot.availableSlots || 0);
    const t = Number(lot.totalSlots || 0) || 1;
    if (a <= 0) return { label: "Sold out", cls: "status-sold" };
    const ratio = Math.max(0, Math.min(1, a / t));
    // More granular bands (7 + sold out)
    if (ratio >= 0.8) return { label: "Plenty", cls: "status-plenty" };
    if (ratio >= 0.55) return { label: "Available", cls: "status-available" };
    if (ratio >= 0.35) return { label: "Moderate", cls: "status-moderate" };
    if (ratio >= 0.22) return { label: "Busy", cls: "status-busy" };
    if (ratio >= 0.12) return { label: "Limited", cls: "status-limited" };
    if (ratio >= 0.05) return { label: "Filling fast", cls: "status-fast" };
    return { label: "Almost full", cls: "status-almost" };
  }

  // Book slot handler
  // Book a slot for the selected parking lot
  async function handleBookSlot() {
    if (!selectedLot || !bookingHour) return;
    setBookingLoading(true);
    setBookingMsg("");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/api/parkinglots/${selectedLot._id}/book`,
        { hour: bookingHour },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setBookingMsg("Slot booked successfully!");
      // Signal other tabs/pages (History) to update immediately
      try {
        localStorage.setItem("bookings:refresh", "1");
      } catch {
        // ignore storage signaling errors
      }
      // Update lot info in UI
      setParkingLots((lots) =>
        lots.map((l) => (l._id === selectedLot._id ? res.data.lot : l))
      );
      setSelectedLot(res.data.lot);
    } catch (err) {
      setBookingMsg(err.response?.data?.message || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  }

  // Flip cards on hover instead of click
  function onCardEnter(lotId) {
    setFlippedId(lotId);
  }
  function onCardLeave() {
    setFlippedId(null);
  }

  // Start expanding popup from the clicked card element
  // Start expanding popup animation from the clicked card
  function startExpandFrom(el, lot) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startStyle = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setSelectedLot(lot);
    setBookingHour("");
    setBookingMsg("");
    setExpand({ lot, style: startStyle, rect });
    // transition to target size next frame
    requestAnimationFrame(() => {
      const vw = Math.min(window.innerWidth * 0.92, 640);
      const vh = Math.min(window.innerHeight * 0.75, 520);
      const left = (window.innerWidth - vw) / 2;
      const top = Math.max(24, (window.innerHeight - vh) / 2);
      setExpand(
        (prev) =>
          prev && { ...prev, style: { left, top, width: vw, height: vh } }
      );
    });
  }

  // Open directions from user's current location to the lot
  function openDirections(lot) {
    try {
      const destLat = lot?.location?.coordinates?.[1];
      const destLng = lot?.location?.coordinates?.[0];
      if (destLat == null || destLng == null) {
        setError("Destination coordinates unavailable for this parking lot.");
        return;
      }

      const withGeolocation = (onSuccess) => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude),
            () =>
              onSuccess(
                currentCoordsRef.current.latitude,
                currentCoordsRef.current.longitude
              ),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
          );
        } else {
          onSuccess(
            currentCoordsRef.current.latitude,
            currentCoordsRef.current.longitude
          );
        }
      };

      withGeolocation((origLat, origLng) => {
        // Always use Google Maps for directions
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origLat},${origLng}&destination=${destLat},${destLng}&travelmode=driving`;
        window.open(url, "_blank", "noopener,noreferrer");
      });
    } catch (e) {
      setError("Failed to open directions. Try again.");
      void e;
    }
  }

  // Close expanding popup (shrink back to card if visible)
  // Close expanding popup (shrink back to card if visible)
  function closeExpand() {
    if (!expand) return;
    const target = document.getElementById(`slot-${expand.lot._id}`);
    const rect = target?.getBoundingClientRect?.();
    const endStyle = rect
      ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      : expand.rect;
    setExpand((prev) => prev && { ...prev, style: endStyle, closing: true });
    setTimeout(() => setExpand(null), 320);
  }

  return (
    <div className="dashboard-container">
      <div className={`dashboard-content${expand ? " blurred" : ""}`}>
        <h2 className="dashboard-title">📍 Park Nearby with ParkEasy</h2>
        <div className="controls-row">
          <input
            className="search-input"
            placeholder="Search a location (city, address)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="small-button" onClick={handleSearch}>
            Search
          </button>
          <button className="small-button" onClick={useMyLocation}>
            Use My Location
          </button>
          {searching && <span style={{ marginLeft: 8 }}>Searching…</span>}
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <div className="last-updated">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              marginTop: 6,
              zIndex: 1000,
              maxHeight: 240,
              overflowY: "auto",
              width: "min(92vw, 640px)",
            }}
          >
            {suggestions.map((s) => (
              <div
                key={`${s.place_id}`}
                onClick={() => pickSuggestion(s)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {s.display_name}
              </div>
            ))}
          </div>
        )}

        <div className="map-wrap">
          <div id="dashboard-map" ref={mapRef} />
        </div>
        {notice && !error && (
          <p style={{ color: "#2563eb", marginBottom: 12 }}>{notice}</p>
        )}

        {loading && (
          <div className="loading-wrap">
            <div className="spinner" aria-label="loading" />
            <p>Detecting nearest parking lots...</p>
          </div>
        )}

        {error && (
          <div>
            <p style={{ color: "#ef4444", marginBottom: 12 }}>{error}</p>
            <button className="retry-button" onClick={askLocationAndLoad}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && parkingLots.length === 0 && (
          <div>
            <p>No nearby parking lots found for your location.</p>
            <button className="retry-button" onClick={useDemoLocation}>
              Use Demo Location
            </button>
          </div>
        )}

        <div className="slot-grid">
          {parkingLots.map((lot) => {
            const isFlipped = flippedId === lot._id;
            const status = getAvailabilityStatus(lot);
            return (
              <div
                id={`slot-${lot._id}`}
                key={lot._id}
                className={`slot${
                  selectedLot && selectedLot._id === lot._id ? " selected" : ""
                } ${isFlipped ? "flipped" : ""}`}
                onMouseEnter={() => onCardEnter(lot._id)}
                onMouseLeave={() => onCardLeave()}
              >
                <div className="slot-inner">
                  <div className="slot-front">
                    <div className="slot-front-plain">
                      <div className="slot-name">{lot.name}</div>
                      <div className="slot-distance">
                        {formatDistance(lot.distance || 0)}
                      </div>
                      <div className="slot-progress">
                        {(() => {
                          const r = getOccupancyRatio(lot);
                          const percentage = Math.round(r * 100);
                          return (
                            <div
                              className="bar"
                              title={`${percentage}% filled`}
                            >
                              <div
                                className={`bar-fill ${barClassForRatio(r)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className={`status-pill ${status.cls}`}>
                      {status.label}
                    </div>
                  </div>
                  <div className="slot-back">
                    <div className="slot-back-header">
                      <div className="slot-name">{lot.name}</div>
                      <div className="slot-distance">
                        {formatDistance(lot.distance || 0)}
                      </div>
                    </div>
                    <div className="slot-back-stats">
                      <div>
                        Slots: {lot.availableSlots} / {lot.totalSlots}
                      </div>
                      <div>Status: {status.label}</div>
                      <div>Cars parked: {lot.carsParked || 0}</div>
                      <div className="slot-progress">
                        {(() => {
                          const r = getOccupancyRatio(lot);
                          const percentage = Math.round(r * 100);
                          return (
                            <div
                              className="bar"
                              title={`${percentage}% filled`}
                            >
                              <div
                                className={`bar-fill ${barClassForRatio(r)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="slot-back-actions">
                      <button
                        className="confirm-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const slotEl = e.currentTarget.closest(".slot");
                          startExpandFrom(slotEl, lot);
                        }}
                      >
                        Book
                      </button>
                      <button
                        className="retry-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDirections(lot);
                        }}
                        title="Open directions in Google Maps"
                      >
                        Directions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {expand && (
        <div className="expand-overlay" aria-modal="true" role="dialog">
          <div className="expand-backdrop" onClick={closeExpand} />
          <div
            className="expand-card"
            style={{
              left: expand.style.left,
              top: expand.style.top,
              width: expand.style.width,
              height: expand.style.height,
            }}
          >
            {selectedLot && (
              <div className="expand-content">
                <div className="expand-header">
                  <div className="expand-title">{selectedLot.name}</div>
                  <button className="retry-button" onClick={closeExpand}>
                    Close
                  </button>
                </div>
                <div className="meta">
                  Distance: {formatDistance(selectedLot.distance || 0)} • Slots
                  left: {selectedLot.availableSlots} • Cars parked:{" "}
                  {selectedLot.carsParked || 0}
                </div>
                <div className="booking-controls" style={{ marginTop: 8 }}>
                  <label htmlFor="booking-hour">Select hour:</label>
                  <input
                    id="booking-hour"
                    type="number"
                    min="0"
                    max="23"
                    value={bookingHour}
                    onChange={(e) => setBookingHour(e.target.value)}
                    style={{ width: 64, marginLeft: 8 }}
                  />
                  <button
                    className="confirm-button"
                    onClick={handleBookSlot}
                    disabled={
                      bookingLoading ||
                      !bookingHour ||
                      selectedLot.availableSlots < 1
                    }
                  >
                    {bookingLoading ? "Booking..." : "Book Slot"}
                  </button>
                </div>
                {bookingMsg && (
                  <div
                    style={{
                      marginTop: 10,
                      color: bookingMsg.includes("success")
                        ? "#34d399"
                        : "#ef4444",
                    }}
                  >
                    {bookingMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
