import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

const PhotoEvidenceModal = ({ open, onClose, evidenceFilename, studentInfo }) => {
  const { token } = useAuth();
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = null;

    if (open && evidenceFilename) {
      setLoading(true);
      setError("");
      setImageUrl(null);

      // Fetch protected evidence image with JWT Authorization header
      axios
        .get(`${API_BASE_URL}/api/evidence/${evidenceFilename}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        })
        .then((res) => {
          objectUrl = URL.createObjectURL(res.data);
          setImageUrl(objectUrl);
        })
        .catch((err) => {
          setError(
            err.response?.data?.message || "Failed to load authenticated photo evidence."
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, evidenceFilename, token]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-gray-100 flex justify-between items-center">
        <div>
          <span className="font-bold text-gray-900">Attendance Photo Evidence</span>
          {studentInfo && (
            <p className="text-xs text-gray-500 font-normal mt-0.5">
              {studentInfo.name} ({studentInfo.rollnumber})
            </p>
          )}
        </div>
      </DialogTitle>
      <DialogContent className="p-4 flex flex-col items-center justify-center min-h-[300px]">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8">
            <CircularProgress size={36} />
            <span className="text-xs text-gray-500">Decrypting & loading evidence...</span>
          </div>
        )}
        {error && (
          <Typography color="error" className="text-center py-6 text-sm">
            {error}
          </Typography>
        )}
        {imageUrl && !loading && (
          <div className="w-full flex flex-col items-center">
            <img
              src={imageUrl}
              alt="Student Attendance Evidence"
              className="max-h-[65vh] w-auto rounded-xl object-contain shadow-sm border border-gray-200"
            />
            <div className="mt-2 text-center">
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
                Verified Geo-Tagged Submission
              </span>
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions className="border-t border-gray-100 px-4 py-2.5">
        <Button onClick={onClose} variant="outlined" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PhotoEvidenceModal;
