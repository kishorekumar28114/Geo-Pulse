import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  FaCamera,
  FaHistory,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaHourglassStart,
  FaBuilding,
  FaUserGraduate,
  FaMapMarkerAlt,
  FaImage,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

import Navbar from "../components/Navbar";
import StatusBadge from "../components/StatusBadge";
import GeoTagCameraModal from "../components/GeoTagCameraModal";
import PhotoEvidenceModal from "../components/PhotoEvidenceModal";

const DashboardPage = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Today's sessions state
  const [sessionData, setSessionData] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");

  // Attendance History state
  const [history, setHistory] = useState([]);
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Camera & Photo Modals
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [activeSessionForCapture, setActiveSessionForCapture] = useState("morning");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Toast notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const fetchSessions = async () => {
    if (!user) return;
    setSessionsLoading(true);
    setSessionError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/attendance/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessionData(res.data);
    } catch (err) {
      setSessionError(err.response?.data?.message || "Failed to retrieve session status.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      let url = `${API_BASE_URL}/api/attendance/history`;
      if (historyDateFilter) url += `?date=${encodeURIComponent(historyDateFilter)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(res.data.history || []);
    } catch (err) {
      console.error("Error fetching history:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchHistory();
    // eslint-disable-next-line
  }, [user, historyDateFilter]);

  const handleCaptureSuccess = (result) => {
    setSnackbar({
      open: true,
      message: result.message || "Attendance recorded successfully!",
      severity: "success",
    });
    fetchSessions();
    fetchHistory();
  };

  const handleLaunchCamera = (sessionKey) => {
    setActiveSessionForCapture(sessionKey);
    setCameraModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "mark") {
            handleLaunchCamera("morning");
          } else {
            setActiveTab(tab);
          }
        }}
      />

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ================================================================= */}
        {/* TAB 1: STUDENT DASHBOARD */}
        {/* ================================================================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Student Banner */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-md shadow-blue-500/20">
                  <FaUserGraduate />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Welcome, {user?.name}!
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                      Roll No: {user?.rollnumber}
                    </span>
                    <span>•</span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                      Room {user?.roomno || "Pending Assignment"}
                    </span>
                    {user?.floor && <span>• Floor {user.floor}</span>}
                  </div>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-gray-100 sm:pl-6 w-full sm:w-auto">
                <span className="text-xs text-gray-400 uppercase tracking-wider block font-medium">
                  Hostel Location
                </span>
                <span className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1 mt-0.5">
                  <FaMapMarkerAlt className="text-emerald-500" />
                  Campus Perimeter (500m)
                </span>
              </div>
            </div>

            {sessionError && <Alert severity="error">{sessionError}</Alert>}

            {/* Today's Attendance Sessions Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Today's Attendance Sessions</h2>
                <span className="text-xs text-gray-500 font-medium">
                  Date: {sessionData?.today || "Today"}
                </span>
              </div>

              {sessionsLoading ? (
                <div className="py-12 flex justify-center">
                  <CircularProgress size={32} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessionData?.sessions?.map((sess) => {
                    const isMorning = sess.session === "morning";
                    const isPresent = sess.status === "present";
                    const isAbsent = sess.status === "absent";
                    const isWaiting = sess.status === "waiting";
                    const isNotStarted = sess.status === "not-started";

                    return (
                      <div
                        key={sess.session}
                        className={`rounded-2xl border p-5 shadow-sm bg-white transition-all flex flex-col justify-between ${
                          isPresent
                            ? "border-emerald-200 shadow-emerald-500/5"
                            : isAbsent
                            ? "border-rose-200"
                            : isWaiting
                            ? "border-amber-300 ring-2 ring-amber-400/20"
                            : "border-gray-200"
                        }`}
                      >
                        <div>
                          {/* Session Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Session
                              </span>
                              <h3 className="text-lg font-bold text-gray-900 capitalize">
                                {sess.session} Attendance
                              </h3>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">
                                {new Date(sess.startTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                -{" "}
                                {new Date(sess.deadline).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                (Deadline)
                              </p>
                            </div>
                            <StatusBadge status={sess.status} size="md" />
                          </div>

                          {/* Present Confirmation Card */}
                          {isPresent && sess.attendanceRecord && (
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 my-3 text-xs space-y-1 text-emerald-800">
                              <div className="flex items-center gap-1.5 font-bold">
                                <FaCheckCircle className="text-emerald-600" />
                                <span>Attendance Confirmed & Saved</span>
                              </div>
                              <div className="text-[11px] text-emerald-700">
                                Recorded at{" "}
                                {new Date(sess.attendanceRecord.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}{" "}
                                • Distance: {sess.attendanceRecord.distanceMeters}m from hostel
                              </div>
                              {sess.attendanceRecord.evidenceUrl && (
                                <button
                                  onClick={() => {
                                    setSelectedPhoto(
                                      sess.attendanceRecord.evidenceUrl.split("/").pop()
                                    );
                                    setPhotoModalOpen(true);
                                  }}
                                  className="mt-2 text-xs text-emerald-700 underline font-semibold flex items-center gap-1"
                                >
                                  <FaImage className="text-2xs" />
                                  <span>View verified snapshot</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Waiting Banner */}
                          {isWaiting && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 my-3 text-xs text-amber-800">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <FaHourglassStart className="text-amber-600 animate-pulse" />
                                <span>Attendance window is currently open!</span>
                              </div>
                              <p className="text-[11px] text-amber-700 mt-1">
                                Capture your live photo and GPS coordinates before the deadline
                                expires to be marked Present.
                              </p>
                            </div>
                          )}

                          {/* Not Started Banner */}
                          {isNotStarted && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 my-3 text-xs text-gray-600 flex items-center gap-2">
                              <FaClock className="text-gray-400" />
                              <span>
                                Opens at{" "}
                                {new Date(sess.startTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}

                          {/* Absent Banner */}
                          {isAbsent && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 my-3 text-xs text-rose-800">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <FaTimesCircle className="text-rose-600" />
                                <span>Absence Finalized</span>
                              </div>
                              <p className="text-[11px] text-rose-700 mt-0.5">
                                The session deadline elapsed without an authoritative attendance
                                submission. Contact your hostel warden for corrections.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Footer */}
                        <div className="pt-3 border-t border-gray-100 mt-2">
                          {sess.canSubmit ? (
                            <Button
                              variant="contained"
                              color="primary"
                              fullWidth
                              startIcon={<FaCamera />}
                              onClick={() => handleLaunchCamera(sess.session)}
                              className="rounded-xl font-bold py-2 shadow-sm"
                            >
                              Register Attendance Now
                            </Button>
                          ) : isPresent ? (
                            <span className="block text-center text-xs font-semibold text-emerald-700 py-1.5">
                              ✓ Verified for Today
                            </span>
                          ) : isAbsent ? (
                            <span className="block text-center text-xs font-medium text-rose-600 py-1.5">
                              Session Closed
                            </span>
                          ) : (
                            <Button
                              variant="outlined"
                              fullWidth
                              disabled
                              size="small"
                              className="rounded-xl"
                            >
                              Window Not Open
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick History Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FaHistory className="text-blue-600" />
                  <h3 className="font-bold text-gray-900 text-base">Recent Attendance History</h3>
                </div>
                <Button size="small" onClick={() => setActiveTab("history")}>
                  View Full History
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Date</th>
                      <th className="py-2.5 px-3.5">Session</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5">Time Marked</th>
                      <th className="py-2.5 px-3.5">Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {history.slice(0, 5).map((row) => (
                      <tr key={row._id} className="hover:bg-gray-50/70">
                        <td className="py-2.5 px-3.5 font-mono text-gray-900 font-medium">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3.5 capitalize font-medium text-gray-600">
                          {row.session}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <StatusBadge status={row.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3.5 text-gray-500 font-mono">
                          {new Date(row.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3.5 text-gray-600 font-mono text-[11px]">
                          {row.distanceMeters !== undefined ? `${row.distanceMeters}m` : "Verified"}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400">
                          No previous attendance records recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: FULL ATTENDANCE HISTORY */}
        {/* ================================================================= */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">My Attendance History</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete authoritative history of all your marked attendance sessions
                </p>
              </div>

              <div className="flex items-center gap-2">
                <TextField
                  type="date"
                  size="small"
                  label="Filter by Date"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  className="w-44"
                />
                {historyDateFilter && (
                  <Button size="small" onClick={() => setHistoryDateFilter("")}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {historyLoading ? (
              <div className="py-12 flex justify-center">
                <CircularProgress size={32} />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3.5">Date</th>
                      <th className="py-3 px-3.5">Session</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Timestamp</th>
                      <th className="py-3 px-3.5">GPS / Distance</th>
                      <th className="py-3 px-3.5">Source</th>
                      <th className="py-3 px-3.5">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {history.map((row) => (
                      <tr key={row._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-medium text-gray-900">
                          {row.date}
                        </td>
                        <td className="py-3 px-3.5 capitalize font-semibold text-gray-700">
                          {row.session}
                        </td>
                        <td className="py-3 px-3.5">
                          <StatusBadge status={row.status} size="sm" />
                        </td>
                        <td className="py-3 px-3.5 text-gray-500 font-mono">
                          {new Date(row.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3.5 text-gray-600 font-mono text-[11px]">
                          {row.distanceMeters !== undefined ? `${row.distanceMeters}m` : "Verified"}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {row.source || "student-app"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          {row.imageUrl ? (
                            <button
                              onClick={() => {
                                setSelectedPhoto(row.imageUrl);
                                setPhotoModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                            >
                              <FaImage className="text-2xs" />
                              <span>View Photo</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">
                          No attendance records found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: STUDENT PROFILE */}
        {/* ================================================================= */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm max-w-xl mx-auto space-y-5">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-sm">
                {user?.name?.charAt(0) || "S"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
                <p className="text-xs text-gray-500 font-mono">Roll Number: {user?.rollnumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-400 block font-medium">Assigned Hostel Room</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                  {user?.roomno ? `Room ${user.roomno}` : "Unassigned"}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-400 block font-medium">Hostel Floor</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">
                  Floor {user?.floor || "1"}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-400 block font-medium">Registered Email</span>
                <span className="text-sm font-medium text-gray-900 mt-0.5 block truncate">
                  {user?.email || "—"}
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-gray-400 block font-medium">Contact Phone</span>
                <span className="text-sm font-medium text-gray-900 mt-0.5 block">
                  {user?.phone || "—"}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              <p className="font-semibold">Room Assignment Accuracy</p>
              <p className="mt-0.5">
                Your hostel room assignment is configured by the warden. If your room allocation has
                changed, please contact the hostel office.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Camera Capture Modal */}
      <GeoTagCameraModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCaptureSuccess}
        sessionName={activeSessionForCapture}
      />

      {/* Secure Evidence Viewer Modal */}
      <PhotoEvidenceModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        evidenceFilename={selectedPhoto}
        studentInfo={{ name: user?.name, rollnumber: user?.rollnumber }}
      />

      {/* Toast Notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default DashboardPage;
