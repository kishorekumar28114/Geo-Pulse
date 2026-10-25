import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
} from "@mui/material";
import {
  FaDoorOpen,
  FaSearch,
  FaImage,
  FaEdit,
  FaTimes,
  FaUsers,
  FaMapMarkerAlt,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";
import StatusBadge from "./StatusBadge";
import PhotoEvidenceModal from "./PhotoEvidenceModal";
import AdminCorrectionModal from "./AdminCorrectionModal";

const RoomDetailModal = ({ open, onClose, roomId, roomNumber, date, session }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals inside Room Detail
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState(null);

  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedStudentForCorrection, setSelectedStudentForCorrection] = useState(null);

  const fetchRoomAttendance = async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      let url = `${API_BASE_URL}/api/admin/rooms/${roomId}/attendance?date=${date}&session=${session}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoomData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load room attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && roomId) {
      fetchRoomAttendance();
    }
    // eslint-disable-next-line
  }, [open, roomId, date, session, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRoomAttendance();
  };

  const handleOpenPhoto = (student) => {
    const filename = student.attendanceRecord?.evidenceUrl?.split("/").pop();
    if (filename) {
      setSelectedPhoto(filename);
      setSelectedStudentForPhoto({ name: student.name, rollnumber: student.rollnumber });
      setPhotoModalOpen(true);
    }
  };

  const handleOpenCorrection = (student) => {
    setSelectedStudentForCorrection(student);
    setCorrectionModalOpen(true);
  };

  const handleCorrectionSaved = () => {
    fetchRoomAttendance();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        {/* Header */}
        <DialogTitle className="border-b border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <FaDoorOpen className="text-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    Room {roomNumber || roomData?.room?.roomNumber}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                    Floor {roomData?.room?.floor || "1"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold uppercase">
                    {session} • {date}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Eligible Room Members & Authoritative Attendance
                </p>
              </div>
            </div>
            <IconButton onClick={onClose} size="small">
              <FaTimes />
            </IconButton>
          </div>

          {/* Quick Metrics Banner */}
          {roomData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4 pt-3 border-t border-gray-200/80 text-xs text-center">
              <div className="bg-white p-2 rounded-lg border border-gray-200">
                <span className="block font-bold text-gray-800 text-sm">
                  {roomData.summary.eligibleCount}
                </span>
                <span className="text-gray-500">Occupancy</span>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <span className="block font-bold text-emerald-700 text-sm">
                  {roomData.summary.presentCount}
                </span>
                <span className="text-emerald-700">Present</span>
              </div>
              <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                <span className="block font-bold text-rose-700 text-sm">
                  {roomData.summary.absentCount}
                </span>
                <span className="text-rose-700">Absent</span>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                <span className="block font-bold text-amber-800 text-sm">
                  {roomData.summary.waitingCount}
                </span>
                <span className="text-amber-800">Waiting</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="block font-bold text-slate-700 text-sm">
                  {roomData.summary.notStartedCount}
                </span>
                <span className="text-slate-600">Not Started</span>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                <span className="block font-bold text-blue-700 text-sm">
                  {roomData.summary.attendancePercentage !== null
                    ? `${roomData.summary.attendancePercentage}%`
                    : "N/A"}
                </span>
                <span className="text-blue-700">Attendance</span>
              </div>
            </div>
          )}
        </DialogTitle>

        <DialogContent className="p-4 sm:p-6">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto flex-1">
              <TextField
                placeholder="Search member name or roll number..."
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <FaSearch className="text-gray-400 mr-2 text-xs" />,
                }}
              />
              <Button type="submit" variant="outlined" size="small">
                Search
              </Button>
            </form>

            <div className="flex gap-2 w-full sm:w-auto">
              <TextField
                select
                size="small"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-44"
                label="Status Filter"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="present">Present</MenuItem>
                <MenuItem value="absent">Absent</MenuItem>
                <MenuItem value="waiting">Waiting</MenuItem>
                <MenuItem value="not-started">Not Started</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
              </TextField>
              {statusFilter && (
                <Button size="small" onClick={() => setStatusFilter("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Student Members Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CircularProgress size={32} />
              <span className="text-xs text-gray-500">Loading room attendance...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-rose-600 text-sm">{error}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-2xs">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3.5">Student</th>
                    <th className="py-3 px-3.5">Roll Number</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Time Marked</th>
                    <th className="py-3 px-3.5">GPS / Distance</th>
                    <th className="py-3 px-3.5">Evidence</th>
                    <th className="py-3 px-3.5 text-right">Correction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {roomData?.students && roomData.students.length > 0 ? (
                    roomData.students.map((student) => {
                      const hasPhoto = Boolean(student.attendanceRecord?.evidenceUrl);
                      const timeStr = student.attendanceRecord?.timestamp
                        ? new Date(student.attendanceRecord.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—";

                      return (
                        <tr key={student.studentId} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-medium text-gray-900">
                            <div>{student.name}</div>
                            {student.phone && (
                              <div className="text-[11px] text-gray-400">{student.phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-gray-600">
                            {student.rollnumber}
                          </td>
                          <td className="py-3 px-3.5">
                            <StatusBadge status={student.status} size="sm" />
                          </td>
                          <td className="py-3 px-3.5 text-gray-500 font-mono">{timeStr}</td>
                          <td className="py-3 px-3.5 text-gray-600">
                            {student.attendanceRecord ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                <FaMapMarkerAlt className="text-emerald-500 text-2xs" />
                                {student.attendanceRecord.distanceMeters !== undefined
                                  ? `${student.attendanceRecord.distanceMeters}m`
                                  : "Verified"}
                              </span>
                            ) : student.failedAttempts?.length > 0 ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                                Failed Attempt ({student.failedAttempts[0].distanceMeters}m)
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            {hasPhoto ? (
                              <button
                                onClick={() => handleOpenPhoto(student)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                              >
                                <FaImage className="text-2xs" />
                                <span>Photo</span>
                              </button>
                            ) : (
                              <span className="text-gray-400 italic">No photo</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <button
                              onClick={() => handleOpenCorrection(student)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
                            >
                              <FaEdit className="text-2xs text-gray-500" />
                              <span>Correct</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        No eligible students found matching the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>

        <DialogActions className="border-t border-gray-200 px-4 py-2.5 bg-gray-50">
          <Button onClick={onClose} variant="contained" size="small">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Nested Modals */}
      <PhotoEvidenceModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        evidenceFilename={selectedPhoto}
        studentInfo={selectedStudentForPhoto}
      />

      <AdminCorrectionModal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        studentData={selectedStudentForCorrection}
        selectedDate={date}
        selectedSession={session}
        onSaved={handleCorrectionSaved}
      />
    </>
  );
};

export default RoomDetailModal;
