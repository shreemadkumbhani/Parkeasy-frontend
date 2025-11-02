import { useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      // Notify same-tab listeners and other tabs immediately
      try {
        localStorage.setItem("auth:tick", String(Date.now()));
      } catch (e) {
        void e;
      }
      try {
        window.dispatchEvent(new Event("auth:changed"));
      } catch (e) {
        void e;
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2 className="login-title">Login</h2>
        {error && <p className="login-error">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          className="login-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="login-password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
            className="login-eye-btn"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>
        <button type="submit" className="login-button">
          Login
        </button>
        <div className="login-forgot">
          <Link to="/forgot-password">Forgot Password?</Link>
        </div>
      </form>
    </div>
  );
}
