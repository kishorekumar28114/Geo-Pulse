import React from "react";

const SummaryCard = ({ title, value, subtitle, icon: Icon, color = "blue", badge }) => {
  const colorMap = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-100",
      iconBg: "bg-blue-600 text-white",
    },
    green: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-100",
      iconBg: "bg-emerald-600 text-white",
    },
    red: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-100",
      iconBg: "bg-rose-600 text-white",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-100",
      iconBg: "bg-amber-600 text-white",
    },
    gray: {
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
      iconBg: "bg-slate-600 text-white",
    },
    purple: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-100",
      iconBg: "bg-purple-600 text-white",
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {value}
            </span>
            {badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${scheme.border} ${scheme.bg} ${scheme.text}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-lg shadow-sm ${scheme.iconBg}`}>
            <Icon />
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;
