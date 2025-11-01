import { useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import "./Login.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/forgot-password`, {
        email,
      });
      const baseMsg =
        res.data?.message ||
        "If that email exists, a reset link has been sent.";
      if (res.data?.resetUrl) {
        try {
          const token = new URL(res.data.resetUrl).searchParams.get("token");
          const localUrl = `${window.location.origin}/reset-password?token=${token}`;
          setMessage(`${baseMsg}\n${localUrl}`);
        } catch {
          setMessage(`${baseMsg}\n${res.data.resetUrl}`);
        }
      } else {
        setMessage(baseMsg);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2 className="login-title">Forgot Password</h2>
        {error && <p className="login-error">{error}</p>}
        {message && <p className="login-success">{message}</p>}
        <input
          type="email"
          placeholder="Enter your registered email"
          className="login-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          pattern="^[^\s@]+@gmail\.com$"
          title="Please use your Gmail address (e.g., name@gmail.com)"
          required
        />
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </div>
  );
}
