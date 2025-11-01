import { useEffect, useState } from "react";
import "./BookingHistory.css";
import axios from "axios";
import { API_BASE } from "../../config";
import html2canvas from "html2canvas";

// Helper to format date/time
function formatDateTime(dt) {
  return new Date(dt).toLocaleString();
}

// Helper to get booking status
function getStatus(booking) {
  const now = Date.now();
  if (booking.endTime && now > booking.endTime) return "Completed";
  if (booking.startTime && now < booking.startTime) return "Upcoming";
  return "Active";
}

// Helper to get Google Maps link
function getMapsLink(booking) {
  if (booking.latitude && booking.longitude) {
    return `https://www.google.com/maps?q=${booking.latitude},${booking.longitude}`;
  }
  return null;
}

// Helper to generate a QR code with booking details
function getQRCodeUrl(booking) {
  const qrData = `Booking ID: ${booking.id}\nLot: ${booking.lotName}\nSlot: ${
    booking.slot
  }\nTime: ${new Date(booking.time).toLocaleString()}`;
  const encodedData = encodeURIComponent(qrData);
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodedData}&bgcolor=23232a&color=ffffff`;
}

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("desc");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState({}); // { [bookingId]: string }
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState({}); // { [bookingId]: boolean }

  // Fetch booking history from backend API
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BASE}/api/bookings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setBookings(res.data.bookings || []);
    } catch (error) {
      console.error("Failed to fetch bookings", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBookings();
  }, []);

  // Auto-refresh every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(fetchBookings, 30000);
    return () => clearInterval(interval);
  }, []);

  // React to cross-tab updates: if booking is added elsewhere and a flag is set in localStorage
  useEffect(() => {
    function onStorage(e) {
      if (e.key === "bookings:refresh" && e.newValue === "1") {
        fetchBookings();
        // reset flag
        localStorage.setItem("bookings:refresh", "0");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Download a styled receipt as an image using html2canvas
  async function downloadReceiptAsImage(index) {
    const node = document.getElementById(`receipt-card-${index}`);
    if (!node) return;
    const canvas = await html2canvas(node, { backgroundColor: null });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking-receipt-${index + 1}.png`;
    a.click();
  }

  // Cancel a booking by id (calls backend to cancel and refreshes)
  async function handleCancelById(bookingId) {
    if (!bookingId) return;
    if (!window.confirm("Cancel this booking?")) return;
    try {
      setCancelling((s) => ({ ...s, [bookingId]: true }));
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/api/bookings/${bookingId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      // Refresh bookings after successful cancellation
      fetchBookings();
    } catch (error) {
      console.error("Failed to cancel booking", error);
      // Fallback: remove from UI only
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } finally {
      setCancelling((s) => ({ ...s, [bookingId]: false }));
    }
  }

  // Add or update review (calls backend and refreshes)
  async function handleReviewById(bookingId, value) {
    if (!bookingId) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_BASE}/api/bookings/${bookingId}/review`,
        { review: value },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      // Refresh bookings after successful review submission
      fetchBookings();
      setReview((r) => ({ ...r, [bookingId]: "" }));
    } catch (error) {
      console.error("Failed to save review", error);
      // Fallback: update UI only
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, review: value } : b))
      );
      setReview((r) => ({ ...r, [bookingId]: "" }));
    }
  }

  // Pagination
  const perPage = 2;
  let filtered = bookings;
  if (filter !== "all")
    filtered = filtered.filter((b) => getStatus(b) === filter);
  if (sort === "asc") filtered = [...filtered].sort((a, b) => a.time - b.time);
  else filtered = [...filtered].sort((a, b) => b.time - a.time);
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="history-container">
      <h2 className="history-title">
        🕓 Booking History{" "}
        {loading && (
          <span style={{ fontSize: 14, color: "#666" }}>(Updating...)</span>
        )}
      </h2>
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}
      >
        <label>
          Filter:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="all">All</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
          </select>
        </label>
        <label>
          Sort:
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </label>
        <button
          onClick={fetchBookings}
          style={{
            padding: "4px 8px",
            borderRadius: 4,
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="no-history">No bookings found.</p>
      ) : (
        <ul className="history-list">
          {paged.map((booking, index) => {
            const globalIndex = (currentPage - 1) * perPage + index;
            const status = getStatus(booking);
            const mapsLink = getMapsLink(booking);
            return (
              <li key={booking.id || globalIndex} className="history-item">
                {/* Hidden offscreen receipt template for image download only */}
                <div
                  id={`receipt-card-${globalIndex}`}
                  style={{
                    position: "fixed",
                    left: -10000,
                    top: -10000,
                    padding: 20,
                    background: "#23232a",
                    borderRadius: 10,
                    maxWidth: 420,
                    color: "#fff",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 20,
                      marginBottom: 8,
                      color: "#3b82f6",
                    }}
                  >
                    ParkEasy Booking Receipt
                  </div>
                  <div>
                    <b>Booking ID:</b> {booking.id}
                  </div>
                  <div>
                    <b>Parking Lot:</b> {booking.lotName || "(Unknown)"}
                  </div>
                  <div>
                    <b>Slot:</b> #{booking.slot}
                  </div>
                  <div>
                    <b>Booked At:</b> {formatDateTime(booking.time)}
                  </div>
                  {booking.startTime && booking.endTime && (
                    <div>
                      <b>Duration:</b> {formatDateTime(booking.startTime)} -{" "}
                      {formatDateTime(booking.endTime)}
                    </div>
                  )}
                  <div>
                    <b>Status:</b> {status}
                  </div>
                  <div>
                    <b>Price:</b> {booking.price ? `₹${booking.price}` : "-"}
                  </div>
                  <div>
                    <b>Vehicle:</b> {booking.vehicle || "-"}
                  </div>
                  {mapsLink && (
                    <div>
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#60a5fa" }}
                      >
                        View on Map
                      </a>
                    </div>
                  )}
                  <div style={{ margin: "8px 0" }}>
                    <img src={getQRCodeUrl(booking)} alt="QR Code" />
                  </div>
                </div>

                {/* Visible compact booking summary */}
                <div className="booking-summary">
                  <div className="summary-header">
                    <div className="summary-title">
                      {booking.lotName || "(Unknown)"}
                    </div>
                    <div
                      className={`summary-status status-${status.toLowerCase()}`}
                    >
                      {status}
                    </div>
                  </div>
                  <div className="summary-row">
                    <b>Slot:</b> #{booking.slot}
                  </div>
                  <div className="summary-row">
                    <b>Booked:</b> {formatDateTime(booking.time)}
                  </div>
                  {booking.startTime && booking.endTime && (
                    <div className="summary-row">
                      <b>Window:</b> {formatDateTime(booking.startTime)} -{" "}
                      {formatDateTime(booking.endTime)}
                    </div>
                  )}
                  <div className="summary-row">
                    <b>Price:</b> {booking.price ? `₹${booking.price}` : "-"}
                  </div>
                  <div className="summary-row">
                    <b>Vehicle:</b> {booking.vehicle || "-"}
                  </div>
                  {mapsLink && (
                    <div className="summary-row">
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="maps-link"
                      >
                        View on Map
                      </a>
                    </div>
                  )}
                </div>
                <button
                  className="receipt-btn"
                  onClick={() => downloadReceiptAsImage(globalIndex)}
                >
                  Download Receipt
                </button>
                {status === "Upcoming" && (
                  <button
                    className="cancel-btn"
                    disabled={!!cancelling[booking.id]}
                    onClick={() => handleCancelById(booking.id)}
                  >
                    Cancel Booking
                  </button>
                )}
                {status === "Completed" && (
                  <div className="review-section">
                    <label>
                      Review:
                      <input
                        type="text"
                        value={review[booking.id] ?? booking.review ?? ""}
                        onChange={(e) =>
                          setReview((r) => ({
                            ...r,
                            [booking.id]: e.target.value,
                          }))
                        }
                        placeholder="Write a review..."
                        style={{ marginLeft: 8 }}
                      />
                    </label>
                    <button
                      className="review-btn"
                      onClick={() =>
                        handleReviewById(booking.id, review[booking.id] || "")
                      }
                      style={{ marginLeft: 8 }}
                    >
                      Save
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
