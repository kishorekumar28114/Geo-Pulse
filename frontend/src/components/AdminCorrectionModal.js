import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";
import StatusBadge from "./StatusBadge";

const AdminCorrectionModal = ({ open, onClose, studentData, selectedDate, selectedSession, onSaved }) => {
  const { token, user } = useAuth();
  const [newStatus, setNewStatus] = useState("present");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!reason.trim()) {
      setError("A non-empty correction reason is mandatory for audit accountability.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const attendanceId = studentData.attendanceRecord?.id || studentData.attendanceRecord?._id;

      if (attendanceId) {
        // Update existing authoritative attendance record
        await axios.patch(
          `${API_BASE_URL}/api/admin/attendance/${attendanceId}`,
          {
            status: newStatus,
            session: selectedSession,
            reason: reason.trim(),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Manually mark student who does not have an attendance record yet
        await axios.post(
          `${API_BASE_URL}/api/admin/attendance/manual`,
          {
            studentId: studentData.studentId,
            date: selectedDate,
            session: selectedSession,
            status: newStatus,
            reason: reason.trim(),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setReason("");
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit attendance correction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-gray-100 font-bold text-gray-900">
        Administrative Attendance Correction
      </DialogTitle>
      <DialogContent className="pt-4 flex flex-col gap-4">
        {error && <Alert severity="error">{error}</Alert>}

        {/* Student metadata info card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-600 grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-400 block">Student:</span>
            <span className="font-semibold text-gray-800 text-sm">{studentData?.name}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Roll Number:</span>
            <span className="font-mono font-medium text-gray-800">{studentData?.rollnumber}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Session & Date:</span>
            <span className="font-medium text-gray-800 uppercase">
              {selectedSession} • {selectedDate}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Current Status:</span>
            <div className="mt-0.5">
              <StatusBadge status={studentData?.status} size="sm" />
            </div>
          </div>
        </div>

        {/* Status selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Corrected Status <span className="text-red-500">*</span>
          </label>
          <TextField
            select
            fullWidth
            size="small"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          >
            <MenuItem value="present">Present</MenuItem>
            <MenuItem value="absent">Absent</MenuItem>
          </TextField>
        </div>

        {/* Mandatory Reason Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Correction Reason <span className="text-red-500">* (Required)</span>
          </label>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Document why this correction is necessary (e.g. Medical leave verified, technical camera malfunction, warden permission)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            size="small"
            required
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
          <p className="font-semibold">Audit Accountability Notice:</p>
          <p className="mt-0.5 text-amber-700">
            This correction is permanently logged in the audit trail with your administrator identity (
            {user?.name}), timestamp, original values, and entered reason.
          </p>
        </div>
      </DialogContent>
      <DialogActions className="border-t border-gray-100 px-4 py-3">
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={loading || !reason.trim()}
          startIcon={loading && <CircularProgress size={16} color="inherit" />}
        >
          Confirm & Save Correction
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdminCorrectionModal;
