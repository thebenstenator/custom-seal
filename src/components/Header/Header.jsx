import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Droplets, User } from "lucide-react";
import "./Header.css";

export default function Header() {
  const navigate = useNavigate();
  // TODO: This will come from auth context later
  const isLoggedIn = false; // Hardcoded for now

  return (
    <header className="header">
      <div className="header__container">
        <Link to="/" className="header__brand">
          <Droplets className="header__icon" size={32} />
          <h1 className="header__title">CustomSeal</h1>
        </Link>

        <div className="header__actions">
          {isLoggedIn ? (
            <button
              className="header__button header__button--account"
              onClick={() => navigate("/account")}
            >
              <User size={20} />
              <span>My Account</span>
            </button>
          ) : (
            <>
              <button
                className="header__button header__button--login"
                onClick={() => navigate("/login")}
              >
                Log In
              </button>
              <button
                className="header__button header__button--signup"
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
