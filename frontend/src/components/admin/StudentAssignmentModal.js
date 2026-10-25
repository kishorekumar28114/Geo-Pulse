import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../config";

const StudentAssignmentModal = ({ open, onClose, student, onAssigned }) => {
  const { token } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedRoomId(student?.roomId?._id || student?.roomId || "");
      setError("");
      setLoading(true);

      axios
        .get(`${API_BASE_URL}/api/admin/rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setRooms(res.data.rooms || []);
        })
        .catch((err) => {
          setError("Failed to fetch available hostel rooms.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, student, token]);

  const handleAssign = async () => {
    setSubmitting(true);
    setError("");

    try {
      await axios.patch(
        `${API_BASE_URL}/api/admin/students/${student._id}`,
        { roomId: selectedRoomId || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      onAssigned && onAssigned();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update student room assignment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="border-b border-gray-100 font-bold text-gray-900">
        Assign Hostel Room
      </DialogTitle>
      <DialogContent className="p-4 flex flex-col gap-3">
        {error && <Alert severity="error">{error}</Alert>}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-gray-800 text-sm">{student?.name}</p>
          <p className="text-gray-500 font-mono mt-0.5">Roll No: {student?.rollnumber}</p>
          <p className="text-gray-500 mt-0.5">
            Current Room:{" "}
            <span className="font-semibold text-gray-700">
              {student?.roomId?.roomNumber || student?.roomno || "None"}
            </span>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <CircularProgress size={24} />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Destination Room
            </label>
            <TextField
              select
              fullWidth
              size="small"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              <MenuItem value="">— Unassign Room —</MenuItem>
              {rooms.map((rm) => {
                const isFull = rm.currentOccupants >= rm.capacity && rm._id !== student?.roomId?._id;
                return (
                  <MenuItem key={rm._id} value={rm._id} disabled={isFull}>
                    Room {rm.roomNumber} (Floor {rm.floor}) — {rm.currentOccupants}/{rm.capacity} Occupied
                    {isFull ? " [FULL]" : ""}
                  </MenuItem>
                );
              })}
            </TextField>
            <p className="text-[11px] text-gray-500 mt-1">
              Rooms with reached capacity are automatically disabled to prevent overcrowding.
            </p>
          </div>
        )}
      </DialogContent>
      <DialogActions className="border-t border-gray-100 px-4 py-2.5">
        <Button onClick={onClose} color="inherit" size="small">
          Cancel
        </Button>
        <Button
          onClick={handleAssign}
          variant="contained"
          color="primary"
          disabled={submitting || loading}
          size="small"
          startIcon={submitting && <CircularProgress size={14} color="inherit" />}
        >
          Save Assignment
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudentAssignmentModal;
