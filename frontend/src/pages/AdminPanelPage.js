import React, { useState, useEffect } from "react";
import {
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Pagination,
  Switch,
} from "@mui/material";
import {
  FaSyncAlt,
  FaCalendarAlt,
  FaClock,
  FaPlus,
  FaSearch,
  FaDownload,
  FaExclamationCircle,
  FaUsers,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaChartPie,
  FaHistory,
  FaDoorOpen,
  FaEdit,
  FaImage,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

import Navbar from "../components/Navbar";
import SummaryCard from "../components/SummaryCard";
import RoomCard from "../components/RoomCard";
import StatusBadge from "../components/StatusBadge";
import RoomDetailModal from "../components/RoomDetailModal";
import PhotoEvidenceModal from "../components/PhotoEvidenceModal";
import AdminCorrectionModal from "../components/AdminCorrectionModal";
import RoomManagementModal from "../components/admin/RoomManagementModal";
import StudentAssignmentModal from "../components/admin/StudentAssignmentModal";

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const AdminPanelPage = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Global Filter State (Date & Session)
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [selectedSession, setSelectedSession] = useState("morning");
  const [refreshing, setRefreshing] = useState(false);

  // Notification state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // -------------------------------------------------------------------------
  // 1. DASHBOARD & ROOM OVERVIEW DATA
  // -------------------------------------------------------------------------
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/dashboard?date=${selectedDate}&session=${selectedSession}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDashboardData(res.data);
    } catch (err) {
      setDashboardError(err.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setDashboardLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 2. ROOM-WISE ATTENDANCE TAB DATA
  // -------------------------------------------------------------------------
  const [roomSummaries, setRoomSummaries] = useState([]);
  const [roomFloors, setRoomFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Room Detail & Creation Modals
  const [selectedRoomForDetail, setSelectedRoomForDetail] = useState(null);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  const fetchRoomSummaries = async () => {
    setRoomsLoading(true);
    try {
      let url = `${API_BASE_URL}/api/admin/attendance/room-summary?date=${selectedDate}&session=${selectedSession}`;
      if (selectedFloor) url += `&floor=${encodeURIComponent(selectedFloor)}`;
      if (roomSearch) url += `&search=${encodeURIComponent(roomSearch)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRoomSummaries(res.data.rooms || []);
      setRoomFloors(res.data.floors || []);
    } catch (err) {
      console.error("Error fetching room summaries:", err.message);
    } finally {
      setRoomsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 3. STUDENT ROSTER & ROOM ASSIGNMENT DATA
  // -------------------------------------------------------------------------
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedStudentForAssignment, setSelectedStudentForAssignment] = useState(null);

  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      let url = `${API_BASE_URL}/api/admin/students`;
      if (studentSearch) url += `?search=${encodeURIComponent(studentSearch)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err.message);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleToggleStudentActive = async (student) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/students/${student._id}`,
        { isActive: !student.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchStudents();
      setSnackbar({
        open: true,
        message: `Student account ${!student.isActive ? "activated" : "deactivated"} successfully`,
        severity: "info",
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update student status",
        severity: "error",
      });
    }
  };

  // -------------------------------------------------------------------------
  // 4. ATTENDANCE RECORDS DATA (Filterable & Paginated)
  // -------------------------------------------------------------------------
  const [records, setRecords] = useState([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsRollFilter, setRecordsRollFilter] = useState("");
  const [recordsStatusFilter, setRecordsStatusFilter] = useState("");
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Evidence and Correction Modals for Records Tab
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState(null);

  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedStudentForCorrection, setSelectedStudentForCorrection] = useState(null);

  const fetchRecords = async (page = recordsPage) => {
    setRecordsLoading(true);
    try {
      let url = `${API_BASE_URL}/api/admin/attendance?date=${selectedDate}&session=${selectedSession}&page=${page}&limit=20`;
      if (recordsRollFilter) url += `&rollnumber=${encodeURIComponent(recordsRollFilter)}`;
      if (recordsStatusFilter) url += `&status=${encodeURIComponent(recordsStatusFilter)}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords(res.data.records || []);
      setRecordsTotal(res.data.total || 0);
      setRecordsPage(res.data.page || 1);
      setRecordsTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Error fetching records:", err.message);
    } finally {
      setRecordsLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 5. SESSION CONFIGURATION DATA
  // -------------------------------------------------------------------------
  const [sessionConfigs, setSessionConfigs] = useState([]);
  const [morningConfig, setMorningConfig] = useState({
    startTime: "09:00",
    endTime: "11:00",
    gracePeriodMinutes: 15,
    isEnabled: true,
  });
  const [eveningConfig, setEveningConfig] = useState({
    startTime: "18:00",
    endTime: "20:00",
    gracePeriodMinutes: 15,
    isEnabled: true,
  });
  const [configSaving, setConfigSaving] = useState(false);

  const fetchSessionConfigs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/session-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data.configs || [];
      setSessionConfigs(list);
      const m = list.find((c) => c.session === "morning");
      if (m) setMorningConfig(m);
      const e = list.find((c) => c.session === "evening");
      if (e) setEveningConfig(e);
    } catch (err) {
      console.error("Error loading session configs:", err.message);
    }
  };

  const handleSaveConfig = async (sessionKey, configData) => {
    setConfigSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/api/admin/session-config/${sessionKey}`, configData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSnackbar({
        open: true,
        message: `${sessionKey.toUpperCase()} session configuration updated for future dates!`,
        severity: "success",
      });
      fetchSessionConfigs();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to update configuration",
        severity: "error",
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTriggerFinalize = async () => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/sessions/finalize`,
        { date: selectedDate, session: selectedSession },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSnackbar({ open: true, message: res.data.message, severity: "success" });
      handleGlobalRefresh();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to finalize session",
        severity: "error",
      });
    }
  };

  // -------------------------------------------------------------------------
  // 6. AUDIT HISTORY DATA
  // -------------------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  const fetchAuditLogs = async (page = auditPage) => {
    setAuditLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/audit?page=${page}&limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAuditLogs(res.data.logs || []);
      setAuditPage(res.data.page || 1);
      setAuditTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error("Error loading audit logs:", err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // 7. REPORTS & CSV EXPORT HANDLERS
  // -------------------------------------------------------------------------
  const [studentReportRoll, setStudentReportRoll] = useState("");
  const [studentReportData, setStudentReportData] = useState(null);
  const [studentReportLoading, setStudentReportLoading] = useState(false);

  const fetchStudentReport = async () => {
    if (!studentReportRoll) return;
    setStudentReportLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/admin/reports/student?rollnumber=${encodeURIComponent(
          studentReportRoll
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudentReportData(res.data);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Student not found",
        severity: "error",
      });
    } finally {
      setStudentReportLoading(false);
    }
  };

  const downloadCsvBlob = async (url, fallbackFilename) => {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const disposition = res.headers["content-disposition"];
      let filename = fallbackFilename;
      if (disposition && disposition.includes("filename=")) {
        const matches = disposition.match(/filename="?([^";]+)"?/);
        if (matches && matches[1]) filename = matches[1];
      }

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || "Failed to download CSV export.",
        severity: "error",
      });
    }
  };

  const downloadDailyCsv = () => {
    const url = `${API_BASE_URL}/api/admin/export/daily?date=${selectedDate}&session=${selectedSession}`;
    downloadCsvBlob(url, `attendance-${selectedDate}-${selectedSession}.csv`);
  };

  const downloadRoomWiseCsv = () => {
    const url = `${API_BASE_URL}/api/admin/export/room-wise?date=${selectedDate}&session=${selectedSession}`;
    downloadCsvBlob(url, `room-attendance-${selectedDate}-${selectedSession}.csv`);
  };

  const downloadStudentCsv = () => {
    if (!studentReportRoll) {
      setSnackbar({ open: true, message: "Please enter a roll number first", severity: "warning" });
      return;
    }
    const url = `${API_BASE_URL}/api/admin/export/student?rollnumber=${encodeURIComponent(
      studentReportRoll
    )}`;
    downloadCsvBlob(url, `student-${studentReportRoll}-history.csv`);
  };

  // -------------------------------------------------------------------------
  // Refresh coordinator
  // -------------------------------------------------------------------------
  const handleGlobalRefresh = () => {
    setRefreshing(true);
    Promise.all([
      fetchDashboard(),
      fetchRoomSummaries(),
      fetchStudents(),
      fetchRecords(1),
      fetchSessionConfigs(),
      fetchAuditLogs(1),
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  useEffect(() => {
    handleGlobalRefresh();
    // eslint-disable-next-line
  }, [selectedDate, selectedSession]);

  const handleRoomSelect = (room) => {
    setSelectedRoomForDetail(room);
    setRoomDetailOpen(true);
  };

  const sessionInstance = dashboardData?.sessionInstance;
  const summary = dashboardData?.summary;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Global Session Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-1.5">
              <FaCalendarAlt className="text-gray-400 text-sm" />
              <TextField
                type="date"
                size="small"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40 bg-white"
                InputLabelProps={{ shrink: true }}
              />
            </div>

            {/* Session Selector */}
            <div className="flex items-center gap-1.5">
              <FaClock className="text-gray-400 text-sm" />
              <TextField
                select
                size="small"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-36 bg-white"
              >
                <MenuItem value="morning">Morning</MenuItem>
                <MenuItem value="evening">Evening</MenuItem>
              </TextField>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outlined"
              size="small"
              onClick={handleGlobalRefresh}
              disabled={refreshing}
              startIcon={<FaSyncAlt className={refreshing ? "animate-spin" : ""} />}
              className="text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              Refresh
            </Button>
          </div>

          {/* Session Lifecycle Deadline Pill */}
          {sessionInstance && (
            <div className="flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500">
                Session Window:
              </span>
              <span className="font-mono font-medium">
                {new Date(sessionInstance.startTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(sessionInstance.deadline).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                  sessionInstance.lifecycleStatus === "finalized"
                    ? "bg-emerald-100 text-emerald-800"
                    : sessionInstance.lifecycleStatus === "active"
                    ? "bg-blue-100 text-blue-800 animate-pulse"
                    : sessionInstance.lifecycleStatus === "grace-period"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {sessionInstance.lifecycleStatus}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {dashboardError && <Alert severity="error">{dashboardError}</Alert>}

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <SummaryCard
                title="Eligible Students"
                value={summary ? summary.totalEligible : "—"}
                icon={FaUsers}
                color="blue"
              />
              <SummaryCard
                title="Present"
                value={summary ? summary.presentCount : "—"}
                icon={FaCheckCircle}
                color="green"
              />
              <SummaryCard
                title="Absent"
                value={summary ? summary.absentCount : "—"}
                icon={FaTimesCircle}
                color="red"
              />
              <SummaryCard
                title="Waiting"
                value={summary ? summary.waitingCount : "—"}
                icon={FaHourglassHalf}
                color="amber"
              />
              <SummaryCard
                title="Not Started"
                value={summary ? summary.notStartedCount : "—"}
                icon={FaClock}
                color="gray"
              />
              <SummaryCard
                title="Attendance Rate"
                value={summary?.attendancePercentage !== null ? `${summary?.attendancePercentage}%` : "N/A"}
                subtitle="Present / (Present+Absent)"
                icon={FaChartPie}
                color="purple"
              />
            </div>

            {/* Failed GPS Attempts Notice (Displayed Separately) */}
            {summary && summary.failedAttemptsCount > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-800">
                <div className="flex items-center gap-2">
                  <FaExclamationCircle className="text-amber-600 text-base" />
                  <span>
                    <strong>{summary.failedAttemptsCount} failed submission attempts</strong> (out
                    of radius / GPS errors) detected for this session. Failed attempts are preserved
                    for review and not counted as absences before deadline.
                  </span>
                </div>
                <Button size="small" onClick={() => setActiveTab("records")}>
                  Inspect Attempts
                </Button>
              </div>
            )}

            {/* Room Overview Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Hostel Rooms Overview</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time room occupancy and attendance status for {selectedDate} ({selectedSession})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setActiveTab("rooms")}
                    startIcon={<FaDoorOpen />}
                  >
                    View All Rooms
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    onClick={() => setRoomModalOpen(true)}
                    startIcon={<FaPlus />}
                  >
                    Add Room
                  </Button>
                </div>
              </div>

              {dashboardLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <CircularProgress size={32} />
                  <span className="text-xs text-gray-500">Aggregating room data...</span>
                </div>
              ) : dashboardData?.rooms?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dashboardData.rooms.map((rm) => (
                    <RoomCard key={rm.roomId} room={rm} onSelectRoom={handleRoomSelect} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl p-6">
                  <FaDoorOpen className="text-gray-300 text-4xl mx-auto mb-2" />
                  <p className="text-gray-600 font-semibold text-sm">No hostel rooms registered yet.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Create rooms to start organizing students and monitoring room-wise attendance.
                  </p>
                  <Button
                    variant="contained"
                    size="small"
                    className="mt-3"
                    onClick={() => setRoomModalOpen(true)}
                  >
                    Create First Room
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ROOM-WISE ATTENDANCE (Highest Priority) */}
        {/* ================================================================= */}
        {activeTab === "rooms" && (
          <div className="space-y-5">
            {/* Toolbar: Search, Floor Filter, Add Room */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
                <TextField
                  placeholder="Search room number..."
                  size="small"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && fetchRoomSummaries()}
                  className="w-full sm:w-60"
                  InputProps={{
                    startAdornment: <FaSearch className="text-gray-400 mr-2 text-xs" />,
                  }}
                />
                <TextField
                  select
                  size="small"
                  label="Filter Floor"
                  value={selectedFloor}
                  onChange={(e) => {
                    setSelectedFloor(e.target.value);
                  }}
                  className="w-full sm:w-40"
                >
                  <MenuItem value="">All Floors</MenuItem>
                  {roomFloors.map((fl) => (
                    <MenuItem key={fl} value={fl}>
                      Floor {fl}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="outlined" size="small" onClick={fetchRoomSummaries}>
                  Apply Filter
                </Button>
                {selectedFloor && (
                  <Button size="small" onClick={() => setSelectedFloor("")}>
                    Reset
                  </Button>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FaDownload />}
                  onClick={downloadRoomWiseCsv}
                >
                  Export Room CSV
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  startIcon={<FaPlus />}
                  onClick={() => setRoomModalOpen(true)}
                >
                  New Room
                </Button>
              </div>
            </div>

            {/* Room Cards Grid */}
            {roomsLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2">
                <CircularProgress size={36} />
                <span className="text-xs text-gray-500">Loading room attendance...</span>
              </div>
            ) : roomSummaries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {roomSummaries.map((rm) => (
                  <RoomCard key={rm.roomId} room={rm} onSelectRoom={handleRoomSelect} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8">
                <FaDoorOpen className="text-gray-300 text-4xl mx-auto mb-2" />
                <h3 className="text-gray-800 font-semibold text-base">No matching rooms found</h3>
                <p className="text-gray-500 text-xs mt-1">
                  Try adjusting the floor filter or search query.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: STUDENTS & ROOM ASSIGNMENTS */}
        {/* ================================================================= */}
        {activeTab === "students" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Student Roster & Room Assignments</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Assign active students to hostel rooms and enforce room capacities.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <TextField
                  placeholder="Search name, roll no, room..."
                  size="small"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && fetchStudents()}
                  className="w-full sm:w-64"
                  InputProps={{
                    startAdornment: <FaSearch className="text-gray-400 mr-2 text-xs" />,
                  }}
                />
                <Button variant="outlined" size="small" onClick={fetchStudents}>
                  Search
                </Button>
              </div>
            </div>

            {studentsLoading ? (
              <div className="py-12 flex justify-center">
                <CircularProgress size={32} />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3.5">Roll Number</th>
                      <th className="py-3 px-3.5">Student Name</th>
                      <th className="py-3 px-3.5">Assigned Room</th>
                      <th className="py-3 px-3.5">Floor</th>
                      <th className="py-3 px-3.5">Contact</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {students.map((st) => (
                      <tr key={st._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-medium text-gray-900">
                          {st.rollnumber}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-gray-800">{st.name}</td>
                        <td className="py-3 px-3.5">
                          {st.roomId ? (
                            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Room {st.roomId.roomNumber}
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-gray-500">{st.roomId?.floor || "—"}</td>
                        <td className="py-3 px-3.5 text-gray-500">
                          <div>{st.email}</div>
                          <div className="text-[11px] text-gray-400">{st.phone}</div>
                        </td>
                        <td className="py-3 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              st.isActive !== false
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}
                          >
                            {st.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedStudentForAssignment(st);
                              setAssignmentModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                          >
                            Assign Room
                          </button>
                          <button
                            onClick={() => handleToggleStudentActive(st)}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
                          >
                            {st.isActive !== false ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">
                          No student accounts found.
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
        {/* TAB 4: ATTENDANCE RECORDS (Full Table & Actions) */}
        {/* ================================================================= */}
        {activeTab === "records" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Authoritative Attendance Records</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Filtered records for {selectedDate} ({selectedSession}) with administrative corrections
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <TextField
                  placeholder="Filter roll number..."
                  size="small"
                  value={recordsRollFilter}
                  onChange={(e) => setRecordsRollFilter(e.target.value)}
                  className="w-40"
                />
                <TextField
                  select
                  size="small"
                  value={recordsStatusFilter}
                  onChange={(e) => setRecordsStatusFilter(e.target.value)}
                  className="w-36"
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="present">Present</MenuItem>
                  <MenuItem value="absent">Absent</MenuItem>
                </TextField>
                <Button variant="outlined" size="small" onClick={() => fetchRecords(1)}>
                  Filter
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<FaDownload />}
                  onClick={downloadDailyCsv}
                >
                  Export CSV
                </Button>
              </div>
            </div>

            {recordsLoading ? (
              <div className="py-12 flex justify-center">
                <CircularProgress size={32} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-3.5">Date & Session</th>
                        <th className="py-3 px-3.5">Student</th>
                        <th className="py-3 px-3.5">Roll No</th>
                        <th className="py-3 px-3.5">Room</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Time</th>
                        <th className="py-3 px-3.5">Distance</th>
                        <th className="py-3 px-3.5">Source</th>
                        <th className="py-3 px-3.5">Evidence</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {records.map((rec) => {
                        const hasPhoto = Boolean(rec.imageUrl);
                        return (
                          <tr key={rec._id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="py-3 px-3.5 font-mono text-gray-600">
                              {rec.date}{" "}
                              <span className="uppercase text-[10px] text-gray-400">
                                ({rec.session})
                              </span>
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-gray-900">
                              {rec.studentId?.name || "Student"}
                            </td>
                            <td className="py-3 px-3.5 font-mono text-gray-600">
                              {rec.studentId?.rollnumber || "—"}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                                {rec.studentId?.roomno || "—"}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <StatusBadge status={rec.status} size="sm" />
                            </td>
                            <td className="py-3 px-3.5 text-gray-500 font-mono">
                              {new Date(rec.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-3.5 text-gray-600 font-mono text-[11px]">
                              {rec.distanceMeters !== undefined ? `${rec.distanceMeters}m` : "0m"}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                {rec.source || "student-app"}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              {hasPhoto ? (
                                <button
                                  onClick={() => {
                                    setSelectedPhoto(rec.imageUrl);
                                    setSelectedStudentForPhoto({
                                      name: rec.studentId?.name,
                                      rollnumber: rec.studentId?.rollnumber,
                                    });
                                    setPhotoModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                                >
                                  <FaImage className="text-2xs" />
                                  <span>Photo</span>
                                </button>
                              ) : (
                                <span className="text-gray-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedStudentForCorrection({
                                    studentId: rec.studentId?._id,
                                    name: rec.studentId?.name,
                                    rollnumber: rec.studentId?.rollnumber,
                                    status: rec.status,
                                    attendanceRecord: rec,
                                  });
                                  setCorrectionModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
                              >
                                <FaEdit className="text-2xs text-gray-500" />
                                <span>Correct</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {records.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-gray-400">
                            No attendance records match the selected filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {recordsTotalPages > 1 && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-gray-500">
                      Showing page {recordsPage} of {recordsTotalPages} ({recordsTotal} total records)
                    </span>
                    <Pagination
                      count={recordsTotalPages}
                      page={recordsPage}
                      onChange={(e, val) => fetchRecords(val)}
                      size="small"
                      color="primary"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: REPORTS & CSV EXPORT CENTER */}
        {/* ================================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Report 1: Daily Session Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Daily Attendance Report</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Export full attendance list for {selectedDate} ({selectedSession}) with student
                    roll numbers, status, and Haversine distance.
                  </p>
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Selected Date:</span>
                      <span className="font-semibold">{selectedDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Session:</span>
                      <span className="font-semibold uppercase">{selectedSession}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="contained"
                  color="primary"
                  className="mt-4"
                  startIcon={<FaDownload />}
                  onClick={downloadDailyCsv}
                >
                  Download Daily CSV Export
                </Button>
              </div>

              {/* Report 2: Room-Wise Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Room-Wise Attendance Export</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Export student attendance organized by room numbers and floors for quick
                    warden inspection and physical roll-call verification.
                  </p>
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Target Session:</span>
                      <span className="font-semibold uppercase">
                        {selectedSession} ({selectedDate})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Protection:</span>
                      <span className="font-semibold text-emerald-700">Formula Sanitized</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="contained"
                  color="info"
                  className="mt-4"
                  startIcon={<FaDownload />}
                  onClick={downloadRoomWiseCsv}
                >
                  Download Room-Wise CSV Export
                </Button>
              </div>
            </div>

            {/* Report 3: Individual Student History Report */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Individual Student History Report</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Inspect and download personal attendance history for an individual student.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <TextField
                  placeholder="Enter student roll number (e.g. 21cs101)..."
                  size="small"
                  value={studentReportRoll}
                  onChange={(e) => setStudentReportRoll(e.target.value)}
                  className="w-full sm:w-80"
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={fetchStudentReport}
                  disabled={studentReportLoading}
                  startIcon={studentReportLoading && <CircularProgress size={14} color="inherit" />}
                >
                  Fetch Report
                </Button>
                {studentReportData && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FaDownload />}
                    onClick={downloadStudentCsv}
                  >
                    Download Student CSV
                  </Button>
                )}
              </div>

              {studentReportData && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-900">
                        {studentReportData.student.name} ({studentReportData.student.rollnumber})
                      </h4>
                      <p className="text-xs text-gray-500">
                        Room: {studentReportData.student.roomno || "Unassigned"} • Email:{" "}
                        {studentReportData.student.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block">Overall Attendance Rate</span>
                      <span className="text-xl font-bold text-blue-700">
                        {studentReportData.summary.attendancePercentage !== null
                          ? `${studentReportData.summary.attendancePercentage}%`
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-gray-200">
                      <span className="block font-bold text-sm">
                        {studentReportData.summary.totalRecords}
                      </span>
                      <span className="text-gray-500">Total Records</span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <span className="block font-bold text-emerald-700 text-sm">
                        {studentReportData.summary.presentCount}
                      </span>
                      <span className="text-emerald-700">Present</span>
                    </div>
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                      <span className="block font-bold text-rose-700 text-sm">
                        {studentReportData.summary.absentCount}
                      </span>
                      <span className="text-rose-700">Absent</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: SESSION CONFIGURATION */}
        {/* ================================================================= */}
        {activeTab === "config" && (
          <div className="space-y-6">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
              <p className="font-semibold text-sm mb-0.5">Hostel Session Scheduling & Rules</p>
              <p>
                Configure the authorized daily morning and evening attendance time slots. Changes apply
                to future session instances. Existing past instances maintain their persisted
                deadlines for historical accuracy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Morning Session Configuration */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-gray-900">Morning Session</h3>
                    <p className="text-xs text-gray-500">Asia/Kolkata Timezone</p>
                  </div>
                  <Switch
                    checked={morningConfig.isEnabled}
                    onChange={(e) =>
                      setMorningConfig({ ...morningConfig, isEnabled: e.target.checked })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Start Time (24h)
                    </label>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="09:00"
                      value={morningConfig.startTime}
                      onChange={(e) =>
                        setMorningConfig({ ...morningConfig, startTime: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      End Time (24h)
                    </label>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="11:00"
                      value={morningConfig.endTime}
                      onChange={(e) =>
                        setMorningConfig({ ...morningConfig, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Grace Period (Minutes)
                  </label>
                  <TextField
                    size="small"
                    type="number"
                    fullWidth
                    value={morningConfig.gracePeriodMinutes}
                    onChange={(e) =>
                      setMorningConfig({
                        ...morningConfig,
                        gracePeriodMinutes: Number(e.target.value),
                      })
                    }
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Students remain in Waiting status until End Time + Grace Period has elapsed.
                  </p>
                </div>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={configSaving}
                  onClick={() => handleSaveConfig("morning", morningConfig)}
                >
                  Save Morning Configuration
                </Button>
              </div>

              {/* Evening Session Configuration */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-gray-900">Evening Session</h3>
                    <p className="text-xs text-gray-500">Asia/Kolkata Timezone</p>
                  </div>
                  <Switch
                    checked={eveningConfig.isEnabled}
                    onChange={(e) =>
                      setEveningConfig({ ...eveningConfig, isEnabled: e.target.checked })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Start Time (24h)
                    </label>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="18:00"
                      value={eveningConfig.startTime}
                      onChange={(e) =>
                        setEveningConfig({ ...eveningConfig, startTime: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      End Time (24h)
                    </label>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="20:00"
                      value={eveningConfig.endTime}
                      onChange={(e) =>
                        setEveningConfig({ ...eveningConfig, endTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Grace Period (Minutes)
                  </label>
                  <TextField
                    size="small"
                    type="number"
                    fullWidth
                    value={eveningConfig.gracePeriodMinutes}
                    onChange={(e) =>
                      setEveningConfig({
                        ...eveningConfig,
                        gracePeriodMinutes: Number(e.target.value),
                      })
                    }
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Automatic absence processing creates records only after this deadline.
                  </p>
                </div>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={configSaving}
                  onClick={() => handleSaveConfig("evening", eveningConfig)}
                >
                  Save Evening Configuration
                </Button>
              </div>
            </div>

            {/* Manual Finalizer Action */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Manual Absentee Finalization</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  The background deadline scheduler finalizes absentees automatically every minute.
                  You can also trigger finalization manually if the session deadline has elapsed.
                </p>
              </div>
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={handleTriggerFinalize}
              >
                Trigger Finalize for {selectedDate} ({selectedSession})
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: AUDIT HISTORY (Append-Only Log) */}
        {/* ================================================================= */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Administrator Audit Trail</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Append-only log documenting every attendance correction, mandatory reason, and
                authorized admin identity.
              </p>
            </div>

            {auditLoading ? (
              <div className="py-12 flex justify-center">
                <CircularProgress size={32} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-3.5">Timestamp</th>
                        <th className="py-3 px-3.5">Administrator</th>
                        <th className="py-3 px-3.5">Student Affected</th>
                        <th className="py-3 px-3.5">Action</th>
                        <th className="py-3 px-3.5">Status Transition</th>
                        <th className="py-3 px-3.5">Mandatory Reason Documented</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 px-3.5 font-mono text-gray-600">
                            {new Date(log.timestamp).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-gray-800">
                            {log.adminId?.name || "Administrator"} (
                            {log.adminId?.rollnumber || "admin"})
                          </td>
                          <td className="py-3 px-3.5 font-medium text-gray-900">
                            {log.studentId?.name} ({log.studentId?.rollnumber})
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="font-bold text-[10px] uppercase bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-[11px]">
                            <span className="text-gray-400">
                              {log.oldValues?.status || "None"}
                            </span>{" "}
                            →{" "}
                            <span className="font-bold text-gray-900">
                              {log.newValues?.status || "Updated"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-gray-700 italic max-w-xs truncate">
                            "{log.reason}"
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            No administrative corrections logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {auditTotalPages > 1 && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-gray-500">Page {auditPage} of {auditTotalPages}</span>
                    <Pagination
                      count={auditTotalPages}
                      page={auditPage}
                      onChange={(e, val) => fetchAuditLogs(val)}
                      size="small"
                      color="primary"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* GLOBAL MODALS */}
      {/* =================================================================== */}
      {/* Room Detail Modal (Drilldown) */}
      <RoomDetailModal
        open={roomDetailOpen}
        onClose={() => setRoomDetailOpen(false)}
        roomId={selectedRoomForDetail?.roomId}
        roomNumber={selectedRoomForDetail?.roomNumber}
        date={selectedDate}
        session={selectedSession}
      />

      {/* Room Creation Modal */}
      <RoomManagementModal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        onCreated={() => {
          fetchRoomSummaries();
          fetchDashboard();
          setSnackbar({ open: true, message: "Room created successfully!", severity: "success" });
        }}
      />

      {/* Student Room Assignment Modal */}
      <StudentAssignmentModal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        student={selectedStudentForAssignment}
        onAssigned={() => {
          fetchStudents();
          fetchDashboard();
          setSnackbar({
            open: true,
            message: "Student room assigned successfully!",
            severity: "success",
          });
        }}
      />

      {/* Photo Evidence Modal */}
      <PhotoEvidenceModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        evidenceFilename={selectedPhoto}
        studentInfo={selectedStudentForPhoto}
      />

      {/* Admin Correction Modal */}
      <AdminCorrectionModal
        open={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        studentData={selectedStudentForCorrection}
        selectedDate={selectedDate}
        selectedSession={selectedSession}
        onSaved={() => {
          fetchRecords();
          fetchDashboard();
          setSnackbar({
            open: true,
            message: "Attendance corrected and audit log recorded!",
            severity: "success",
          });
        }}
      />

      {/* Notification Toast */}
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

export default AdminPanelPage;
