import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaBuilding,
  FaThLarge,
  FaDoorOpen,
  FaUsers,
  FaClipboardList,
  FaFileDownload,
  FaCog,
  FaHistory,
  FaSignOutAlt,
  FaUserCircle,
  FaCamera,
  FaUserGraduate,
} from "react-icons/fa";

const Navbar = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = user?.isAdmin;

  const adminNavItems = [
    { id: "overview", label: "Overview", icon: FaThLarge },
    { id: "rooms", label: "Room-wise Attendance", icon: FaDoorOpen },
    { id: "students", label: "Students", icon: FaUsers },
    { id: "records", label: "Attendance Records", icon: FaClipboardList },
    { id: "reports", label: "Reports & Export", icon: FaFileDownload },
    { id: "config", label: "Session Config", icon: FaCog },
    { id: "audit", label: "Audit History", icon: FaHistory },
  ];

  const studentNavItems = [
    { id: "dashboard", label: "My Dashboard", icon: FaThLarge },
    { id: "mark", label: "Mark Attendance", icon: FaCamera },
    { id: "history", label: "My Attendance History", icon: FaClipboardList },
    { id: "profile", label: "Profile", icon: FaUserCircle },
  ];

  const navItems = isAdmin ? adminNavItems : studentNavItems;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FaBuilding className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-lg leading-tight tracking-tight">
                  GeoPulse
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Hostel System
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Smart Room-wise Attendance Management
              </p>
            </div>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-semibold text-gray-800">{user?.name}</span>
              <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                  {user?.rollnumber}
                </span>
                {user?.roomno && (
                  <span className="font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                    Room {user.roomno}
                  </span>
                )}
                {isAdmin ? (
                  <span className="font-semibold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                    Admin
                  </span>
                ) : (
                  <span className="font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                    Student
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              title="Logout"
            >
              <FaSignOutAlt />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none border-t border-gray-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange && onTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <Icon className={isActive ? "text-white" : "text-gray-400"} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
