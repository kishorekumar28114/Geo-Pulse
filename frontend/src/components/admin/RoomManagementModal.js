import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../config";

const RoomManagementModal = ({ open, onClose, onCreated, editingRoom }) => {
  const { token } = useAuth();
  const [roomNumber, setRoomNumber] = useState(editingRoom?.roomNumber || "");
  const [floor, setFloor] = useState(editingRoom?.floor || "1");
  const [capacity, setCapacity] = useState(editingRoom?.capacity || 4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (editingRoom) {
      setRoomNumber(editingRoom.roomNumber || "");
      setFloor(editingRoom.floor || "1");
      setCapacity(editingRoom.capacity || 4);
    } else {
      setRoomNumber("");
      setFloor("1");
      setCapacity(4);
    }
    setError("");
  }, [editingRoom, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setError("Room number is required");
      return;
    }
    if (capacity < 1) {
      setError("Capacity must be at least 1");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (editingRoom) {
        await axios.patch(
          `${API_BASE_URL}/api/admin/rooms/${editingRoom._id || editingRoom.roomId}`,
          { floor, capacity: Number(capacity) },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${API_BASE_URL}/api/admin/rooms`,
          {
            roomNumber: roomNumber.trim().toUpperCase(),
            floor: floor.trim(),
            capacity: Number(capacity),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      onCreated && onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle className="border-b border-gray-100 font-bold text-gray-900">
        {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : "Add New Hostel Room"}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className="p-4 flex flex-col gap-3">
          {error && <Alert severity="error">{error}</Alert>}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Room Number <span className="text-red-500">*</span>
            </label>
            <TextField
              size="small"
              fullWidth
              disabled={Boolean(editingRoom)}
              placeholder="e.g. 101, 204, A1"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Floor <span className="text-red-500">*</span>
            </label>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. 1, 2, G"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Student Capacity <span className="text-red-500">*</span>
            </label>
            <TextField
              size="small"
              type="number"
              fullWidth
              inputProps={{ min: 1, max: 20 }}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </div>
        </DialogContent>
        <DialogActions className="border-t border-gray-100 px-4 py-2.5">
          <Button onClick={onClose} color="inherit" size="small">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            size="small"
            startIcon={loading && <CircularProgress size={14} color="inherit" />}
          >
            {editingRoom ? "Save Changes" : "Create Room"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RoomManagementModal;
