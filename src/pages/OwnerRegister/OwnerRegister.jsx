// Page for parking owners to register their parking lot
import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OwnerRegister.css";

// Fix Leaflet's default icon paths in bundlers (Vite)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export default function OwnerRegister() {
  // State variables for form fields and UI
  const [name, setName] = useState(""); // Parking lot name
  const [position, setPosition] = useState(null); // { lat, lng }
  const [totalSlots, setTotalSlots] = useState(""); // Total slots
  // Address fields
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [loading, setLoading] = useState(false); // Loading state
  const [msg, setMsg] = useState(""); // Status message
  // Get user role from localStorage (default to 'user')
  const [role, setRole] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")?.role || "user";
    } catch {
      return "user";
    }
  });
  const token = localStorage.getItem("token"); // Auth token

  // On mount, try to auto-detect current location for map center
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPosition({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      });
    }
  }, []);

  // Handle form submission to register a new parking lot
  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      if (!position) throw new Error("Please select a location on the map");
      await axios.post(
        `${API_BASE}/api/parkinglots`,
        {
          name,
          latitude: Number(position.lat),
          longitude: Number(position.lng),
          totalSlots: Number(totalSlots),
          address: {
            line1,
            line2,
            landmark,
            city,
            state: stateName,
            pincode,
          },
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setMsg("Parking lot registered successfully!");
      setName("");
      setTotalSlots("");
      setLine1("");
      setLine2("");
      setLandmark("");
      setCity("");
      setStateName("");
      setPincode("");
    } catch (err) {
      setMsg(err.response?.data?.message || "Could not register parking lot");
    } finally {
      setLoading(false);
    }
  }

  // Request to become an owner (upgrade user role)
  async function becomeOwner() {
    setMsg("");
    try {
      await axios.post(
        `${API_BASE}/api/parkinglots/become-owner`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      // Update user role in localStorage
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (user) {
        user.role = "owner";
        localStorage.setItem("user", JSON.stringify(user));
      }
      setRole("owner");
      setMsg("You're now an owner. You can add parking below.");
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to update role");
    }
  }

  // Leaflet map setup
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pinIconRef = useRef(null);

  // Reverse geocode to fill address fields automatically based on map pin
  const reverseGeocodeAndFill = useCallback(
    async (lat, lng) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
            lat
          )}&lon=${encodeURIComponent(lng)}&addressdetails=1`,
          { headers: { Accept: "application/json" } }
        );
        const data = await res.json();
        const addr = data?.address || {};
        // Pincode
        if (addr?.postcode) setPincode(String(addr.postcode).slice(0, 6));
        // City/State
        const cityGuess =
          addr.city || addr.town || addr.village || addr.hamlet || "";
        if (cityGuess) setCity(cityGuess);
        if (addr.state) setStateName(addr.state);

        // Derive Address Line 1 and 2 conservatively (only fill if empty)
        // Line 1: house/building + road
        const house = addr.house_number || addr.building || "";
        const road =
          addr.road ||
          addr.pedestrian ||
          addr.footway ||
          addr.residential ||
          addr.path ||
          addr.cycleway ||
          addr.service ||
          "";
        const line1Candidate = [house, road].filter(Boolean).join(" ") || road;
        if (!line1 && line1Candidate) setLine1(line1Candidate);

        // Line 2: neighbourhood/suburb/locality
        const line2Candidate =
          addr.neighbourhood ||
          addr.suburb ||
          addr.quarter ||
          addr.city_district ||
          addr.locality ||
          addr.village ||
          "";
        if (!line2 && line2Candidate) setLine2(line2Candidate);

        // Landmark: prefer a named place if provided
        const landmarkCandidate =
          data?.name ||
          addr.attraction ||
          addr.amenity ||
          addr.shop ||
          addr.public_building ||
          "";
        if (!landmark && landmarkCandidate) setLandmark(landmarkCandidate);
      } catch {
        // Ignore reverse geocode errors; user can type pincode manually
      }
    },
    [line1, line2, landmark]
  );
  useEffect(() => {
    if (!mapRef.current) {
      const center = position
        ? [position.lat, position.lng]
        : [23.0225, 72.5714];
      const map = L.map("owner-map").setView(center, 14);
      // Satellite tiles (Esri World Imagery)
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and others",
          maxZoom: 19,
        }
      ).addTo(map);

      // Build a drop pin icon (SVG, bundler-safe)
      const pinSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">' +
        '<path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 22 12.5 41 12.5 41S25 22 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ea4335"/>' +
        '<circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>';
      const pinUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
        pinSvg
      )}`;
      pinIconRef.current = L.icon({
        iconUrl: pinUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl,
        shadowSize: [41, 41],
        shadowAnchor: [12, 41],
      });
      map.on("click", (e) => {
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
        setPosition(pos);
        if (!markerRef.current) {
          markerRef.current = L.marker([pos.lat, pos.lng], {
            icon: pinIconRef.current || undefined,
            draggable: true,
          }).addTo(map);
          // Update pincode whenever pin is dragged
          markerRef.current.on("dragend", (ev) => {
            const m = ev.target;
            const ll = m.getLatLng();
            setPosition({ lat: ll.lat, lng: ll.lng });
            reverseGeocodeAndFill(ll.lat, ll.lng);
          });
        } else {
          markerRef.current.setLatLng([pos.lat, pos.lng]);
        }
        reverseGeocodeAndFill(pos.lat, pos.lng);
      });
      mapRef.current = map;
    }
  }, [position, reverseGeocodeAndFill]);
  // When position changes first time (from geolocation), sync map/marker
  useEffect(() => {
    if (!mapRef.current || !position) return;
    mapRef.current.setView([position.lat, position.lng], 14);
    if (!markerRef.current) {
      markerRef.current = L.marker([position.lat, position.lng], {
        icon: pinIconRef.current || undefined,
        draggable: true,
      }).addTo(mapRef.current);
      markerRef.current.on("dragend", (ev) => {
        const m = ev.target;
        const ll = m.getLatLng();
        setPosition({ lat: ll.lat, lng: ll.lng });
        reverseGeocodeAndFill(ll.lat, ll.lng);
      });
    } else {
      markerRef.current.setLatLng([position.lat, position.lng]);
    }
  }, [position, reverseGeocodeAndFill]);

  // Geocode address fields and center map
  async function findByAddress() {
    setMsg("");
    const parts = [line1, line2, landmark, city, stateName, pincode, "India"]
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    if (parts.length === 0) {
      setMsg("Please fill address fields to search");
      return;
    }
    const q = parts.join(", ");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&q=${encodeURIComponent(
          q
        )}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setMsg("No results found for that address");
        return;
      }
      const best = data[0];
      const lat = parseFloat(best.lat);
      const lng = parseFloat(best.lon);
      const pos = { lat, lng };
      setPosition(pos);
      if (mapRef.current) mapRef.current.setView([lat, lng], 16);
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], {
          icon: pinIconRef.current || undefined,
          draggable: true,
        }).addTo(mapRef.current);
        markerRef.current.on("dragend", (ev) => {
          const m = ev.target;
          const ll = m.getLatLng();
          setPosition({ lat: ll.lat, lng: ll.lng });
          reverseGeocodeAndFill(ll.lat, ll.lng);
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      // Fill pincode from forward-geocoded address if available, else reverse lookup
      const postcode = best?.address?.postcode;
      if (postcode) setPincode(String(postcode).slice(0, 6));
      // Also fill city/state when available from forward geocode
      const fwdCity =
        best?.address?.city ||
        best?.address?.town ||
        best?.address?.village ||
        best?.address?.hamlet;
      if (fwdCity) setCity(fwdCity);
      if (best?.address?.state) setStateName(best.address.state);
      // Try to seed address lines from forward geocode as well (do not overwrite if user typed)
      const fwd = best?.address || {};
      const house = fwd.house_number || fwd.building || "";
      const road =
        fwd.road ||
        fwd.pedestrian ||
        fwd.footway ||
        fwd.residential ||
        fwd.path ||
        fwd.cycleway ||
        fwd.service ||
        "";
      const l1 = [house, road].filter(Boolean).join(" ") || road;
      if (!line1 && l1) setLine1(l1);
      const l2 =
        fwd.neighbourhood ||
        fwd.suburb ||
        fwd.quarter ||
        fwd.city_district ||
        fwd.locality ||
        fwd.village ||
        "";
      if (!line2 && l2) setLine2(l2);
      const lm =
        best?.name ||
        fwd.attraction ||
        fwd.amenity ||
        fwd.shop ||
        fwd.public_building ||
        "";
      if (!landmark && lm) setLandmark(lm);
      else reverseGeocodeAndFill(lat, lng);
      setMsg("Centered to searched address");
    } catch {
      setMsg("Address search failed. Try again.");
    }
  }

  return (
    <div className="owner-wrap">
      <h2 className="owner-title">Register Your Parking</h2>
      {role !== "owner" && (
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto 14px auto",
            textAlign: "center",
          }}
        >
          <p>To add parking, become an owner.</p>
          <button className="owner-submit" onClick={becomeOwner}>
            Become Owner
          </button>
        </div>
      )}
      <form className="owner-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Parking name"
            required
          />
        </label>
        <div>
          <div className="map-label">Select Location (drop a pin)</div>
          <div className="map-wrap">
            <div id="owner-map" className="map" />
          </div>
          <div className="coords">
            <span>Latitude: {position ? position.lat.toFixed(6) : "-"}</span>
            <span>Longitude: {position ? position.lng.toFixed(6) : "-"}</span>
            <button
              type="button"
              className="owner-submit use-location"
              onClick={() => {
                if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setPosition({
                      lat: Number(pos.coords.latitude.toFixed(6)),
                      lng: Number(pos.coords.longitude.toFixed(6)),
                    });
                    if (mapRef.current) {
                      mapRef.current.setView(
                        [
                          Number(pos.coords.latitude.toFixed(6)),
                          Number(pos.coords.longitude.toFixed(6)),
                        ],
                        14
                      );
                    }
                    // Auto-fill pincode for current location
                    reverseGeocodeAndFill(
                      Number(pos.coords.latitude),
                      Number(pos.coords.longitude)
                    );
                  });
                }
              }}
            >
              Use my location
            </button>
            <button
              type="button"
              className="owner-submit"
              onClick={findByAddress}
              style={{ marginLeft: 8 }}
            >
              Find by address
            </button>
          </div>
        </div>

        <fieldset className="address">
          <legend>Address</legend>
          <label>
            Address Line 1
            <input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="House/Building, Street"
              required
            />
          </label>
          <label>
            Area / Line 2 (optional)
            <input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              placeholder="Area, Locality"
            />
          </label>
          <label>
            Landmark (optional)
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Nearby landmark"
            />
          </label>
          <div className="row">
            <label>
              City
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </label>
            <label>
              State
              <input
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Pincode
            <input
              value={pincode}
              onChange={(e) =>
                setPincode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              placeholder="6-digit pincode"
              inputMode="numeric"
              pattern="^[0-9]{6}$"
              required
            />
          </label>
        </fieldset>
        <label>
          Total Slots
          <input
            type="number"
            min="1"
            value={totalSlots}
            onChange={(e) => setTotalSlots(e.target.value)}
            placeholder="e.g. 50"
            required
          />
        </label>

        <button
          className="owner-submit"
          disabled={loading || role !== "owner"}
          type="submit"
        >
          {loading ? "Submitting..." : "Register Parking"}
        </button>
      </form>
      {msg && <div className="owner-msg">{msg}</div>}
    </div>
  );
}
