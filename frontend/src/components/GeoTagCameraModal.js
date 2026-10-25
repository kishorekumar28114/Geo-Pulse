import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { FaCamera, FaMapMarkerAlt, FaCheck, FaExclamationTriangle, FaRedo } from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

const HOSTEL_LAT = 10.827764;
const HOSTEL_LON = 77.060015;
const ALLOWED_RADIUS = 500;

function calcClientDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const GeoTagCameraModal = ({ open, onClose, onCapture, sessionName = "morning" }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const { user, token } = useAuth();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(
        "Camera access denied or unavailable. Please enable camera permission in your browser to verify attendance."
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const requestGeolocation = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({
          latitude: lat,
          longitude: lon,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });

        const dist = calcClientDistance(lat, lon, HOSTEL_LAT, HOSTEL_LON);
        setDistanceMeters(dist);
      },
      (err) => {
        let msg = "Unable to retrieve GPS coordinates.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "GPS location permission was denied. Please allow location access to verify attendance.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Location information is currently unavailable. Ensure GPS is switched on.";
        } else if (err.code === err.TIMEOUT) {
          msg = "GPS location request timed out. Please retry.";
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      setLocation(null);
      setDistanceMeters(null);
      setError("");
      setGpsError("");
      startCamera();
      requestGeolocation();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!capturedImage || !location || !user) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(capturedImage);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append("image", blob, `attendance_${Date.now()}.jpg`);
      formData.append("latitude", location.latitude);
      formData.append("longitude", location.longitude);
      formData.append("timestamp", Date.now());
      formData.append("session", sessionName);

      const resp = await axios.post(`${API_BASE_URL}/api/attendance/register`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      onCapture(resp.data);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to record attendance. Please check your network and GPS perimeter."
      );
    } finally {
      setLoading(false);
    }
  };

  const isWithinRadius = distanceMeters !== null && distanceMeters <= ALLOWED_RADIUS;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="border-b border-gray-100 flex items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <FaCamera />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base">Geo-Tag Attendance Camera</span>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {sessionName} Session
            </p>
          </div>
        </div>
      </DialogTitle>

      <DialogContent className="p-4 sm:p-5 flex flex-col gap-3">
        {error && <Alert severity="error">{error}</Alert>}
        {gpsError && (
          <Alert severity="warning" className="text-xs">
            {gpsError}
            <Button size="small" onClick={requestGeolocation} className="ml-2 underline">
              Retry GPS
            </Button>
          </Alert>
        )}

        {/* Live GPS & Radius Indicator Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaMapMarkerAlt className={isWithinRadius ? "text-emerald-500" : "text-amber-500"} />
              <span className="font-semibold text-gray-800">Perimeter Status:</span>
            </div>
            {distanceMeters !== null ? (
              <span
                className={`font-semibold px-2 py-0.5 rounded-full ${
                  isWithinRadius
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {isWithinRadius
                  ? `Inside Hostel (${distanceMeters}m)`
                  : `Outside Perimeter (${distanceMeters}m / max ${ALLOWED_RADIUS}m)`}
              </span>
            ) : (
              <span className="text-gray-400">Acquiring satellite GPS...</span>
            )}
          </div>
          {location && (
            <div className="mt-1.5 text-gray-500 flex justify-between font-mono text-[11px]">
              <span>Lat: {location.latitude.toFixed(6)}</span>
              <span>Lon: {location.longitude.toFixed(6)}</span>
              <span>Acc: ±{Math.round(location.accuracy)}m</span>
            </div>
          )}
        </div>

        {/* Video Viewport / Captured Preview */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-gray-200">
          {cameraLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-2">
              <CircularProgress size={32} color="inherit" />
              <span className="text-xs text-gray-300">Activating camera...</span>
            </div>
          )}

          {!capturedImage && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Attendance Snapshot"
              className="w-full h-full object-cover"
            />
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* Action controls */}
        {!capturedImage ? (
          <div className="flex justify-center pt-1">
            <Button
              onClick={handleCapture}
              variant="contained"
              color="primary"
              disabled={cameraLoading}
              startIcon={<FaCamera />}
              size="medium"
              className="rounded-xl px-6"
            >
              Capture Attendance Photo
            </Button>
          </div>
        ) : (
          <div className="flex justify-center gap-3 pt-1">
            <Button
              onClick={handleRetake}
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<FaRedo />}
            >
              Retake Photo
            </Button>
          </div>
        )}
      </DialogContent>

      <DialogActions className="border-t border-gray-100 px-4 py-3 bg-gray-50">
        <Button onClick={onClose} disabled={loading} color="inherit" size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!capturedImage || !location || loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FaCheck />}
          size="small"
        >
          {loading ? "Recording..." : "Confirm & Submit Attendance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GeoTagCameraModal;
