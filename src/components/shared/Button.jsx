import React from "react";
import { ChevronRight } from "lucide-react";
import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  onClick,
}) {
  const classNames = [
    "button",
    `button--${variant}`,
    fullWidth && "button--full",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} onClick={onClick}>
      {children}
      {variant === "primary" && !fullWidth && <ChevronRight size={20} />}
    </button>
  );
}
