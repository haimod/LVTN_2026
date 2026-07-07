import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import AssetList from './pages/AssetList';
import AssignmentRequestPage from './pages/employee/AssignmentRequestPage';
import ProfilePage from './pages/employee/ProfilePage';
import BorrowHistoryPage from './pages/employee/BorrowHistoryPage';
import AdminAssetListPage from './pages/admin/AdminAssetListPage';
import AdminActivityLogPage from './pages/admin/AdminActivityLogPage';
import AdminBorrowRequestPage from './pages/admin/AdminBorrowRequestPage';
import AdminCategoryListPage from './pages/admin/AdminCategoryListPage';
import AdminDepartmentListPage from './pages/admin/AdminDepartmentListPage';
import AdminEmergencyAllocationPage from './pages/admin/AdminEmergencyAllocationPage';
import AdminLiquidationPage from './pages/admin/AdminLiquidationPage';
import AdminLostReportPage from './pages/admin/AdminLostReportPage';
import AdminMaintenancePage from './pages/admin/AdminMaintenancePage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminReturnRequestPage from './pages/admin/AdminReturnRequestPage';
import AdminUserListPage from './pages/admin/AdminUserListPage';
import ManagerApprovalPage from './pages/manager/ManagerApprovalPage';
import ManagerBorrowHistoryPage from './pages/manager/ManagerBorrowHistoryPage';
import ManagerProfilePage from './pages/manager/ManagerProfilePage';
import ManagerAssignmentRequestPage from './pages/manager/ManagerAssignmentRequestPage';
import ManagerEmployeeListPage from './pages/manager/ManagerEmployeeListPage';
import HandoverConfirmationPage from './pages/asset-lifecycle/HandoverConfirmationPage';

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
            <Route path="/dashboard" element={<DashboardHome />} />
            
            <Route element={<RoleGuard allowedRoles={['admin']} />}>
              <Route path="/admin/assets" element={<AdminAssetListPage />} />
              <Route path="/admin/assets/categories" element={<AdminCategoryListPage />} />
              <Route path="/admin/borrow-requests" element={<AdminBorrowRequestPage />} />
              <Route path="/admin/emergency-allocations" element={<AdminEmergencyAllocationPage />} />
              <Route path="/maintenance/tickets" element={<AdminMaintenancePage key="pending" defaultStatus="pending" />} />
              <Route path="/maintenance/repairing" element={<AdminMaintenancePage key="repairing" defaultStatus="repairing" />} />
              <Route path="/maintenance/blacklist" element={<AdminLostReportPage key="pending" defaultStatus="pending" />} />
              <Route path="/retrieval/requests" element={<AdminReturnRequestPage key="pending" defaultStatus="pending" />} />
              <Route path="/retrieval/liquidation" element={<AdminLiquidationPage />} />
              <Route path="/admin/users" element={<AdminUserListPage />} />
              <Route path="/admin/departments" element={<AdminDepartmentListPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/activity-log" element={<AdminActivityLogPage />} />
              <Route path="/system/users" element={<Navigate to="/admin/users" replace />} />
              <Route path="/system/departments" element={<Navigate to="/admin/departments" replace />} />
              <Route path="/assets/categories" element={<Navigate to="/admin/assets/categories" replace />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['admin', 'manager']} />}>
              <Route path="/assets/list" element={<AssetList />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['admin', 'manager', 'user']} />}>
              <Route path="/employee/assignment-requests" element={<AssignmentRequestPage />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['manager', 'user']} />}>
              <Route path="/employee/handover" element={<HandoverConfirmationPage />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['user']} />}>
              <Route path="/employee/borrow-history" element={<BorrowHistoryPage />} />
              <Route path="/employee/profile" element={<ProfilePage />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={['manager']} />}>
              <Route path="/manager/assignment-approvals" element={<ManagerApprovalPage />} />
              <Route path="/manager/assignment-requests" element={<ManagerAssignmentRequestPage />} />
              <Route path="/manager/employees" element={<ManagerEmployeeListPage />} />
              <Route path="/manager/borrow-history" element={<ManagerBorrowHistoryPage />} />
              <Route path="/manager/profile" element={<ManagerProfilePage />} />
            </Route>

          </Route>
        </Route>
        
      </Routes>
    </Router>
  );
}

export default App;
