import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import "./Button.css";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "back";
  fullWidth?: boolean;
  onClick?: () => void;
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  onClick,
}: ButtonProps) {
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
