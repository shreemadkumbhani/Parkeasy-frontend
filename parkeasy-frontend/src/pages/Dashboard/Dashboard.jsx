// Dashboard page for users to view and book nearby parking lots
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../../config";
import "./Dashboard.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fallback coordinates near seeded demo data (Ahmedabad)
const DEFAULT_COORDS = { latitude: 23.0512, longitude: 72.6677 };

export default function Dashboard() {
  const navigate = useNavigate();
  // State variables for parking lots, loading, errors, booking, and UI
  const [parkingLots, setParkingLots] = useState([]); // List of nearby parking lots (5km radius)
  const [allParkingLots, setAllParkingLots] = useState([]); // All parking lots for map display
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(""); // Error message
  const [selectedLot, setSelectedLot] = useState(null); // Currently selected lot for booking
  const [bookingHour, setBookingHour] = useState(""); // Hour input for booking
  const [bookingMsg, setBookingMsg] = useState(""); // Booking status message
  const [bookingLoading, setBookingLoading] = useState(false); // Booking loading state
  const [expand, setExpand] = useState(null); // Expanding popup state
  const [notice, setNotice] = useState(""); // Non-blocking info message
  const [query, setQuery] = useState(""); // search query text
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sugPos, setSugPos] = useState({ left: 0, top: 0, width: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const currentCoordsRef = useRef(DEFAULT_COORDS);
  const userMarkerRef = useRef(null);
  const parkingIconRef = useRef(null);
  const searchMarkerRef = useRef(null);
  const searchIconRef = useRef(null);
  const manualCenterRef = useRef(false);
  const hasFitOnceRef = useRef(false);

  // Filters state with localStorage persistence
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rangeKm, setRangeKm] = useState(() => {
    try {
      const saved = localStorage.getItem("parkingFilters:rangeKm");
      return saved ? Number(saved) : 5;
    } catch {
      return 5;
    }
  });
  const [selectedArea, setSelectedArea] = useState(() => {
    try {
      return localStorage.getItem("parkingFilters:area") || "all";
    } catch {
      return "all";
    }
  });

  // Cross-device precise dropdown position using visualViewport
  const computeSugPos = useCallback(() => {
    const el = searchInputRef.current;
    if (!el) return { left: 0, top: 0, width: 0 };
    const r = el.getBoundingClientRect();
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const viewportW = vv?.width ?? window.innerWidth;
    const viewportH = vv?.height ?? window.innerHeight;
    const offsetLeft = vv?.offsetLeft ?? 0;
    const offsetTop = vv?.offsetTop ?? 0;
    const maxW = Math.min(640, viewportW - 16);
    const width = Math.min(Math.round(r.width), maxW);
    let left = Math.round(
      r.left - offsetLeft + (r.width > width ? (r.width - width) / 2 : 0)
    );
    left = Math.max(8, Math.min(left, Math.round(viewportW - width - 8)));
    let top = Math.round(r.bottom - offsetTop + 6);
    const maxListH = 240 + 8;
    if (top + maxListH > viewportH) top = Math.max(8, viewportH - maxListH);
    return { left, top, width };
  }, []);

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
    // Ensure `lot` and `availableSlots` are defined before accessing
    if (!lot || typeof lot.availableSlots === "undefined") {
      return 0; // Default value if lot or availableSlots is undefined
    }
    const t = Number(lot.totalSlots) || 1;
    const a = Math.max(0, Number(lot.availableSlots) || 0);
    const used = Math.max(0, t - a);
    return used / t;
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
  // Fetch all parking lots for map display (no radius limit)
  const fetchAllParkingLots = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/parkinglots/all`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setAllParkingLots(res.data.parkingLots || []);
    } catch (err) {
      console.error("Could not fetch all parking lots for map:", err.message);
    }
  }, []);

  const fetchParkingLots = useCallback(
    async (coords, opts = {}) => {
      const { silent = false } = opts;
      if (!silent) {
        setLoading(true);
        setError("");
        setNotice("");
      }
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_BASE}/api/parkinglots`, {
          params: {
            lat: coords.latitude,
            lng: coords.longitude,
            radius: Math.max(500, Math.round((rangeKm || 5) * 1000)),
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        setParkingLots(res.data.parkingLots || []);
        setLastUpdated(new Date());
        currentCoordsRef.current = coords;
        // Update the user marker position on map
        try {
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([
              coords.latitude,
              coords.longitude,
            ]);
          }
        } catch (e) {
          void e;
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Could not fetch parking lots.";
        if (!silent) setError(msg);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [rangeKm]
  );

  // Ask for user's location and load parking lots
  // More robust geo acquisition: try getCurrentPosition, then fallback to watchPosition
  const getPreciseLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        return reject(new Error("Geolocation not supported"));
      }
      let settled = false;
      let watchId = null;
      const cleanup = () => {
        if (watchId != null) {
          try {
            navigator.geolocation.clearWatch(watchId);
          } catch (e) {
            void e;
          }
        }
      };
      // Primary attempt
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          // Fallback: watchPosition for up to 8s to get a fresher fix
          try {
            watchId = navigator.geolocation.watchPosition(
              (pos) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 0 }
            );
          } catch (e) {
            void e;
          }
          setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
          }, 8000);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const askLocationAndLoad = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNotice(
        "Using default location (Ahmedabad) due to no geolocation support."
      );
      fetchParkingLots(DEFAULT_COORDS);
      return;
    }

    setLoading(true);
    setLocating(true);
    setError("");
    setNotice("Requesting your location...");
    getPreciseLocation()
      .then((coords) => {
        setNotice("Location acquired! Loading nearby parking lots...");
        fetchParkingLots(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(
            [coords.latitude, coords.longitude],
            14
          );
        }
      })
      .catch((error) => {
        let errorMsg = "Couldn’t determine your location. ";
        if (error && typeof error.code === "number") {
          if (error.code === 1) {
            errorMsg =
              "Location permission denied. Please enable location access in your browser settings. ";
          } else if (error.code === 2) {
            errorMsg = "Location unavailable. ";
          } else if (error.code === 3) {
            errorMsg = "Location request timeout. ";
          }
        }
        setNotice(errorMsg + "Using default location (Ahmedabad).");
        fetchParkingLots(DEFAULT_COORDS);
      })
      .finally(() => setLocating(false));
  }, [fetchParkingLots, getPreciseLocation]);

  // On mount, ask for location and load lots, and fetch all lots for map
  useEffect(() => {
    askLocationAndLoad();
    fetchAllParkingLots();
  }, [askLocationAndLoad, fetchAllParkingLots]);

  // Auto refresh at intervals (always on)
  useEffect(() => {
    const id = setInterval(() => {
      fetchParkingLots(currentCoordsRef.current, { silent: true });
    }, 15000);
    return () => clearInterval(id);
  }, [fetchParkingLots]);

  // Refetch silently when the search radius changes
  useEffect(() => {
    fetchParkingLots(currentCoordsRef.current, { silent: true });
    // Persist radius to localStorage
    try {
      localStorage.setItem("parkingFilters:rangeKm", String(rangeKm));
    } catch (e) {
      void e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKm]);

  // Persist area selection
  useEffect(() => {
    try {
      localStorage.setItem("parkingFilters:area", selectedArea);
    } catch (e) {
      void e;
    }
  }, [selectedArea]);

  // Haversine distance (in meters) for nearby area computation
  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Dynamic nearby areas (by city) around current location
  const nearbyAreas = useMemo(() => {
    const cur = currentCoordsRef.current;
    const byCity = new Map();
    allParkingLots.forEach((lot) => {
      const city = lot?.address?.city?.trim();
      const coords = lot?.location?.coordinates;
      if (!city || !Array.isArray(coords)) return;
      const lat = coords[1];
      const lon = coords[0];
      if (lat == null || lon == null) return;
      const d = haversine(cur.latitude, cur.longitude, lat, lon);
      if (d <= 20000) {
        const prev = byCity.get(city);
        if (!prev || d < prev) byCity.set(city, d);
      }
    });
    return Array.from(byCity.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
  }, [allParkingLots]);

  // Filtered list according to selected area
  const displayLots = useMemo(() => {
    const base = parkingLots.filter(Boolean);
    if (selectedArea === "all") return base;
    return base.filter((l) => (l?.address?.city || "").trim() === selectedArea);
  }, [parkingLots, selectedArea]);

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

    // Add custom styled labels overlay for place names and roads
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; CartoDB",
        subdomains: "abcd",
        maxZoom: 19,
        opacity: 1.0,
        className: "map-labels-white-bold",
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

  // Update markers whenever allParkingLots change (show all on map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const markers = [];
    allParkingLots.forEach((lot) => {
      const lat = lot.location?.coordinates?.[1];
      const lng = lot.location?.coordinates?.[0];
      if (lat == null || lng == null) return;
      // Use explicit pin icon for parking spots (drop marker)
      const marker = L.marker([lat, lng], {
        icon: parkingIconRef.current || undefined,
      }).addTo(layer);
      // Update marker popup logic
      marker.bindPopup(
        `<strong>${escapeHtml(lot.name || "Unnamed")}</strong><br/>` +
          `${formatDistance(lot.distance || 0)} • ` +
          `${lot?.availableSlots || 0}/${lot?.totalSlots || 0} slots`
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
        // Fit to markers only once on initial load unless user forced a recenter
        if (!manualCenterRef.current && !hasFitOnceRef.current) {
          map.fitBounds(group.getBounds().pad(0.2));
          hasFitOnceRef.current = true;
        }
      } catch (err) {
        void err;
      } finally {
        // Clear manual centering flag after first update cycle
        if (manualCenterRef.current) manualCenterRef.current = false;
      }
    }
  }, [allParkingLots]);

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
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const id = setTimeout(async () => {
      try {
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
        const merged = [];
        const seen = new Set();
        [...lotData, ...geoData].forEach((s) => {
          const key = s.place_id || `${s.lat},${s.lon}`;
          if (!key || seen.has(key)) return;
          seen.add(key);
          merged.push(s);
        });
        setSuggestions(merged);
        const has = merged.length > 0;
        setShowSuggestions(has);
        if (has) setSugPos(computeSugPos());
      } catch (e) {
        setSuggestions([]);
        setShowSuggestions(false);
        void e;
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query, buildSearchUrl, fetchLotSuggestions, computeSugPos]);

  // Keep dropdown aligned while it’s open (resize/scroll)
  useEffect(() => {
    if (!showSuggestions) return;
    const updatePos = () => setSugPos(computeSugPos());
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updatePos);
    vv?.addEventListener("scroll", updatePos);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      vv?.removeEventListener("resize", updatePos);
      vv?.removeEventListener("scroll", updatePos);
    };
  }, [showSuggestions, computeSugPos]);

  // When a suggestion is clicked
  const pickSuggestion = useCallback(
    async (sug) => {
      try {
        const isLot = sug.type === "lot";
        const coords = {
          latitude: parseFloat(sug.lat),
          longitude: parseFloat(sug.lon),
        };
        setQuery(sug.display_name || `${sug.lat}, ${sug.lon}`);
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
    setNotice("");
    setError("");
    askLocationAndLoad();
  }

  // Allow user to manually switch to demo location if nothing loads nearby
  function useDemoLocation() {
    setError("");
    setNotice("Using default location (Ahmedabad) for demo data.");
    fetchParkingLots(DEFAULT_COORDS);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude],
        14
      );
    }
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
    if (!lot) return { label: "Unavailable", cls: "status-limited" };
    const a = Number(lot?.availableSlots ?? 0);
    const t = Number(lot?.totalSlots ?? 0) || 1;
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
      await axios.post(
        `${API_BASE}/api/parkinglots/${selectedLot._id}/book`,
        { hour: bookingHour },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      // Signal other tabs/pages (History) to update immediately
      try {
        localStorage.setItem("bookings:refresh", "1");
      } catch {
        // ignore storage signaling errors
      }
      // Redirect to booking history page
      navigate("/booking-history");
    } catch (err) {
      setBookingMsg(err.response?.data?.message || "Booking failed");
      setBookingLoading(false);
    }
  }

  // Flipping disabled; keep placeholders for compatibility
  function onCardEnter() {}
  function onCardLeave() {}

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
          <div className="search-wrap">
            <input
              className="search-input"
              placeholder="Search a location (city, address)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
                setSugPos(computeSugPos());
              }}
              onBlur={() => {
                // small delay so click can register before list hides
                setTimeout(() => setShowSuggestions(false), 120);
              }}
              ref={searchInputRef}
            />

            {showSuggestions && suggestions.length > 0 && (
              <div
                className="sug-list"
                style={{
                  position: "fixed",
                  left: sugPos.left,
                  top: sugPos.top,
                  width: sugPos.width,
                  zIndex: 1000,
                }}
              >
                {suggestions.map((s) => (
                  <div
                    key={`${s.place_id}`}
                    className="sug-item"
                    onClick={() => pickSuggestion(s)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="small-button" onClick={handleSearch}>
            Search
          </button>
          <button
            className="small-button"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? "Locating…" : "Use My Location"}
          </button>
          <button
            className="small-button"
            style={{ marginLeft: 8 }}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? "Close Filters" : "Filters"}
          </button>
          {searching && <span style={{ marginLeft: 8 }}>Searching…</span>}
          {/* Auto-refresh is now permanent; toggle removed */}
          <div className="last-updated">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {filtersOpen && (
          <div
            className="filters-panel"
            style={{
              position: "fixed",
              left: 12,
              top: 92,
              width: 320,
              maxWidth: "90vw",
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 16,
              zIndex: 1000,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "1px solid #334155",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 16 }}>🔍 Filters</div>
              <button
                onClick={() => {
                  setRangeKm(5);
                  setSelectedArea("all");
                  fetchParkingLots(currentCoordsRef.current);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #475569",
                  color: "#94a3b8",
                  padding: "4px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  color: "#cbd5e1",
                }}
              >
                📏 Search Radius: <span style={{ color: "#60a5fa" }}>{rangeKm} km</span>
              </div>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={rangeKm}
                onChange={(e) => setRangeKm(Number(e.target.value) || 5)}
                style={{
                  width: "100%",
                  accentColor: "#3b82f6",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#64748b",
                  marginTop: 4,
                }}
              >
                <span>1 km</span>
                <span>25 km</span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  color: "#cbd5e1",
                }}
              >
                📍 Filter by Area
              </div>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#1e293b",
                  color: "#f1f5f9",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <option value="all">All areas ({displayLots.length})</option>
                {nearbyAreas.map((name) => {
                  const count = parkingLots.filter(
                    (l) => (l?.address?.city || "").trim() === name
                  ).length;
                  return (
                    <option key={name} value={name}>
                      {name} ({count})
                    </option>
                  );
                })}
              </select>
              {selectedArea !== "all" && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#94a3b8",
                  }}
                >
                  Showing {displayLots.length} lot{displayLots.length !== 1 ? "s" : ""} in {selectedArea}
                </div>
              )}
            </div>
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
          {displayLots.map((lot) => {
            const isFlipped = false; // flipping disabled
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
                onClick={(e) => {
                  const slotEl = e.currentTarget.closest(".slot");
                  startExpandFrom(slotEl, lot);
                }}
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
                  left: {selectedLot?.availableSlots ?? 0} • Cars parked:{" "}
                  {selectedLot?.carsParked || 0}
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
                    disabled={bookingLoading || !bookingHour}
                  >
                    {bookingLoading ? "Booking..." : "Book Slot"}
                  </button>
                  <button
                    className="retry-button"
                    onClick={() => openDirections(selectedLot)}
                    title="Open directions in Google Maps"
                  >
                    Directions
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
