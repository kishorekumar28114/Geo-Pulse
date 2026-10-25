import React, { useState } from "react";
import {
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { FaBuilding, FaSignInAlt } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

const LoginPage = () => {
  const [rollnumber, setRollnumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollnumber: rollnumber.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Login failed. Please check your credentials.");
      }

      login(data.user, data.token);

      if (data.user?.isAdmin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full p-8 sm:p-10 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-500/25 mb-4">
            <FaBuilding />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">GeoPulse Portal</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Smart Room-wise Hostel Attendance & Geolocation Monitoring System
          </p>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Roll Number / ID
            </label>
            <TextField
              variant="outlined"
              fullWidth
              size="medium"
              placeholder="e.g. 21cs101 or admin"
              required
              value={rollnumber}
              onChange={(e) => setRollnumber(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <TextField
              variant="outlined"
              type="password"
              fullWidth
              size="medium"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            className="rounded-xl font-bold py-2.5 mt-2"
            type="submit"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FaSignInAlt />}
          >
            {loading ? "Signing in..." : "Sign In to Portal"}
          </Button>
        </form>

        <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          <span>New student? </span>
          <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
            Register Student Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
