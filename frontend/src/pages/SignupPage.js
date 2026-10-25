import React, { useState } from "react";
import {
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { FaBuilding, FaUserPlus } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../config";

const SignupPage = () => {
  const [form, setForm] = useState({
    name: "",
    rollnumber: "",
    email: "",
    phone: "",
    roomno: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed. Please check the entered data.");
      }

      login(data.user, data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full p-8 sm:p-10 space-y-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/25 mb-3">
            <FaBuilding />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Registration</h1>
          <p className="text-xs text-gray-500 mt-1">
            Register for the Smart Hostel Attendance & Geofencing System
          </p>
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
            <TextField
              name="name"
              fullWidth
              size="small"
              placeholder="e.g. John Doe"
              required
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Roll Number</label>
              <TextField
                name="rollnumber"
                fullWidth
                size="small"
                placeholder="21cs101"
                required
                value={form.rollnumber}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Room Number</label>
              <TextField
                name="roomno"
                fullWidth
                size="small"
                placeholder="e.g. 101, A2"
                value={form.roomno}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
            <TextField
              name="email"
              type="email"
              fullWidth
              size="small"
              placeholder="student@hostel.edu"
              required
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
            <TextField
              name="phone"
              fullWidth
              size="small"
              placeholder="9876543210"
              required
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <TextField
              name="password"
              type="password"
              fullWidth
              size="small"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={handleChange}
            />
          </div>

          <Button
            variant="contained"
            color="success"
            fullWidth
            size="large"
            className="rounded-xl font-bold py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700"
            type="submit"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FaUserPlus />}
          >
            {loading ? "Registering..." : "Create Account"}
          </Button>
        </form>

        <div className="pt-3 border-t border-gray-100 text-center text-xs text-gray-500">
          <span>Already registered? </span>
          <Link to="/login" className="text-emerald-700 font-semibold hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
