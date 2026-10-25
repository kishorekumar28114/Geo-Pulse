import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from './components/StatusBadge';
import SummaryCard from './components/SummaryCard';
import RoomCard from './components/RoomCard';
import { FaUsers } from 'react-icons/fa';

describe('Frontend Component Tests', () => {
  test('StatusBadge renders Present status with green badge', () => {
    render(<StatusBadge status="present" />);
    expect(screen.getByText(/present/i)).toBeInTheDocument();
  });

  test('StatusBadge renders Absent status with red badge', () => {
    render(<StatusBadge status="absent" />);
    expect(screen.getByText(/absent/i)).toBeInTheDocument();
  });

  test('StatusBadge renders Waiting status with amber badge', () => {
    render(<StatusBadge status="waiting" />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });

  test('StatusBadge renders Not Started status', () => {
    render(<StatusBadge status="not-started" />);
    expect(screen.getByText(/not started/i)).toBeInTheDocument();
  });

  test('SummaryCard displays title and numerical metric', () => {
    render(
      <SummaryCard
        title="Total Students"
        value={120}
        subtitle="Active hostel residents"
        icon={FaUsers}
        color="blue"
      />
    );
    expect(screen.getByText(/total students/i)).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  test('RoomCard renders room number, floor, and calculated attendance percentage', () => {
    const mockRoom = {
      roomId: 'room123',
      roomNumber: '101',
      floor: '1',
      capacity: 4,
      eligibleCount: 4,
      presentCount: 3,
      absentCount: 1,
      waitingCount: 0,
      attendancePercentage: 75.0,
    };

    render(<RoomCard room={mockRoom} onSelectRoom={() => {}} />);
    expect(screen.getByText(/Room 101/i)).toBeInTheDocument();
    expect(screen.getByText(/Floor 1/i)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/Inspect Room Members/i)).toBeInTheDocument();
  });
});
