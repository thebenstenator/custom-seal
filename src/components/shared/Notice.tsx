import type { ReactNode } from "react";
import "./Notice.css";

interface NoticeProps {
  variant?: "info" | "gray" | "warning";
  children: ReactNode;
}

export default function Notice({ variant = "info", children }: NoticeProps) {
  return <div className={`notice notice--${variant}`}>{children}</div>;
}
