import React from "react";
import "./Notice.css";

export default function Notice({ variant = "info", children }) {
  return <div className={`notice notice--${variant}`}>{children}</div>;
}
