import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import UserList from './pages/system/UserList';
import DepartmentList from './pages/system/DepartmentList';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          {/* SỬA Ở ĐÂY: Thẻ Dashboard giờ đóng vai trò là CÁI KHUNG bọc ngoài (không có chữ path="/dashboard" nữa) */}
          <Route element={<Dashboard />}>
            
            {/* Các trang con sẽ nằm trong này và có đường dẫn độc lập */}
            
            {/* 1. Trang Tổng quan mặc định */}
            <Route path="/dashboard" element={<h1>Đây là trang Tổng quan (Biểu đồ)</h1>} />
            
            {/* 2. Trang Quản lý nhân sự (Khớp 100% với key trong Menu) */}
            <Route path="/system/users" element={<UserList />} />

            <Route path="/system/departments" element={<DepartmentList />} />
            
            {/* Về sau bạn cứ thêm các trang khác vào đây, ví dụ: */}
            {/* <Route path="/assets/list" element={<AssetList />} /> */}

          </Route>
        </Route>
        
      </Routes>
    </Router>
  );
}

export default App;