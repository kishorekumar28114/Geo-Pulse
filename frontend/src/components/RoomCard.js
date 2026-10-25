import React from "react";
import { FaDoorOpen, FaUsers, FaArrowRight, FaLayerGroup } from "react-icons/fa";

const RoomCard = ({ room, onSelectRoom }) => {
  const {
    roomId,
    roomNumber,
    floor,
    capacity,
    eligibleCount = 0,
    presentCount = 0,
    absentCount = 0,
    waitingCount = 0,
    notStartedCount = 0,
    processingCount = 0,
    attendancePercentage,
  } = room;

  // Percentage color indicator
  let pctColor = "text-gray-500 bg-gray-50 border-gray-200";
  if (attendancePercentage !== null && attendancePercentage !== undefined) {
    if (attendancePercentage >= 90) pctColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
    else if (attendancePercentage >= 75) pctColor = "text-blue-700 bg-blue-50 border-blue-200";
    else if (attendancePercentage >= 50) pctColor = "text-amber-800 bg-amber-50 border-amber-200";
    else pctColor = "text-rose-700 bg-rose-50 border-rose-200";
  }

  return (
    <div
      onClick={() => onSelectRoom && onSelectRoom(room)}
      className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between group"
    >
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <FaDoorOpen className="text-lg" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                Room {roomNumber}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <FaLayerGroup className="text-gray-400" /> Floor {floor}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <FaUsers className="text-gray-400" /> {eligibleCount} Students
                </span>
              </div>
            </div>
          </div>

          {/* Attendance % Pill */}
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${pctColor} shadow-2xs`}
          >
            {attendancePercentage !== null && attendancePercentage !== undefined
              ? `${attendancePercentage}%`
              : "N/A"}
          </div>
        </div>

        {/* Progress Bar (Finalized Attendance) */}
        {eligibleCount > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden flex">
            {presentCount > 0 && (
              <div
                className="bg-emerald-500 h-1.5 transition-all"
                style={{ width: `${(presentCount / eligibleCount) * 100}%` }}
                title={`Present: ${presentCount}`}
              />
            )}
            {absentCount > 0 && (
              <div
                className="bg-rose-500 h-1.5 transition-all"
                style={{ width: `${(absentCount / eligibleCount) * 100}%` }}
                title={`Absent: ${absentCount}`}
              />
            )}
            {waitingCount > 0 && (
              <div
                className="bg-amber-400 h-1.5 transition-all"
                style={{ width: `${(waitingCount / eligibleCount) * 100}%` }}
                title={`Waiting: ${waitingCount}`}
              />
            )}
          </div>
        )}

        {/* Status Count Breakdown Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs mb-4">
          <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
            <span className="block font-bold text-emerald-700 text-sm">{presentCount}</span>
            <span className="text-emerald-700 font-medium">Present</span>
          </div>
          <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-100">
            <span className="block font-bold text-rose-700 text-sm">{absentCount}</span>
            <span className="text-rose-700 font-medium">Absent</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100">
            <span className="block font-bold text-amber-800 text-sm">{waitingCount}</span>
            <span className="text-amber-800 font-medium">Waiting</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="block font-bold text-slate-700 text-sm">
              {notStartedCount > 0 ? notStartedCount : processingCount}
            </span>
            <span className="text-slate-600 font-medium">
              {processingCount > 0 ? "Process" : "Not Open"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:text-blue-700">
        <span>Inspect Room Members</span>
        <FaArrowRight className="transform group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};

export default RoomCard;
