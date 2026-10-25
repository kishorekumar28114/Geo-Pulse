import React from "react";
import { FaCheckCircle, FaTimesCircle, FaClock, FaHourglassStart, FaSyncAlt } from "react-icons/fa";

/**
 * Reusable StatusBadge adhering to the calibrated color palette:
 * Present: Green
 * Absent: Red
 * Waiting: Amber
 * Not Started: Neutral Gray
 * Processing: Blue / Indigo
 */
const StatusBadge = ({ status, size = "md" }) => {
  const norm = (status || "").toLowerCase().trim();

  let config = {
    label: "Unknown",
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    icon: <FaClock className="mr-1.5" />,
  };

  if (norm === "present") {
    config = {
      label: "Present",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <FaCheckCircle className="mr-1.5 text-emerald-600" />,
    };
  } else if (norm === "absent") {
    config = {
      label: "Absent",
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      icon: <FaTimesCircle className="mr-1.5 text-rose-600" />,
    };
  } else if (norm === "waiting") {
    config = {
      label: "Waiting",
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      icon: <FaHourglassStart className="mr-1.5 text-amber-600 animate-pulse" />,
    };
  } else if (norm === "not-started" || norm === "not started") {
    config = {
      label: "Not Started",
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      icon: <FaClock className="mr-1.5 text-slate-500" />,
    };
  } else if (norm === "processing") {
    config = {
      label: "Processing",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
      icon: <FaSyncAlt className="mr-1.5 text-indigo-600 animate-spin" />,
    };
  }

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-semibold";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.border} ${config.bg} ${config.text} ${sizeClasses} shadow-sm`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
