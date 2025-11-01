import React from "react";
import "./SplashScreen.css";
import logo from "../assets/logo.png"; // Adjust path if needed

export default function SplashScreen() {
  return (
    <div className="splash-screen">
      <img src={logo} alt="ParkEasy Logo" className="splash-logo" />
      <div className="splash-name">ParkEasy</div><br></br>
      <div className="spinner"></div>
    </div>
  );
}
