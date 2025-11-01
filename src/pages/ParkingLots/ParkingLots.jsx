import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import "./ParkingLots.css";

export default function ParkingLots() {
  const [lots, setLots] = useState([]);

  useEffect(() => {
    const fetchLots = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/parkinglots`);
        setLots(res.data.parkingLots || []);
      } catch (err) {
        console.error("Failed to fetch parking lots:", err.message);
      }
    };

    fetchLots();
  }, []);

  return (
    <div className="parkinglots-container">
      <h1 className="parkinglots-title">🅿️ Available Parking Lots</h1>

      {lots.length === 0 ? (
        <p className="parkinglots-empty">No parking lots available.</p>
      ) : (
        <div className="parkinglots-grid">
          {lots.map((lot) => (
            <div key={lot._id} className="parkinglot-card">
              <h2 className="parkinglot-name">{lot.name}</h2>
              <p className="parkinglot-location">{lot.location}</p>
              <p className="parkinglot-availability">
                {lot.availableSlots} of {lot.totalSlots} slots available
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
