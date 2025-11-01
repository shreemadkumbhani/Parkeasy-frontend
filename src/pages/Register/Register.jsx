import { useState } from "react";
import axios from "axios";
import { API_BASE } from "../../config";
import { useNavigate } from "react-router-dom";
import "./Register.css";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Simple client-side validation for quick feedback
    // Gmail-only validation
    const emailRegex = /^[^\s@]+@gmail\.com$/i;
    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required");
      return;
    }
    if (!emailRegex.test(String(form.email).toLowerCase())) {
      setError("Email must be a Gmail address (@gmail.com)");
      return;
    }
    if (String(form.password).length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (form.phone && !/^\d{10}$/.test(String(form.phone))) {
      setError("Phone number must be 10 digits");
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/auth/register`, form);
      setSuccess("Registered! Now log in.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2 className="register-title">Register</h2>
        {error && <p className="register-error">{error}</p>}
        {success && <p className="register-success">{success}</p>}
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          className="register-input"
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="register-input"
          pattern="^[^\s@]+@gmail\.com$"
          title="Please use a Gmail address (e.g., name@gmail.com)"
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="phone"
          placeholder="Phone Number"
          className="register-input"
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="register-input"
          onChange={handleChange}
          required
        />
        <button type="submit" className="register-button">
          Register
        </button>
      </form>
    </div>
  );
}
