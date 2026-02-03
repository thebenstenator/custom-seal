import React from "react";
import { Link } from "react-router-dom";
import { Droplets } from "lucide-react";
import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="header__container">
        <Link to="/" className="header__brand">
          <Droplets className="header__icon" size={32} />
          <h1 className="header__title">CustomSeal</h1>
        </Link>
      </div>
    </header>
  );
}
