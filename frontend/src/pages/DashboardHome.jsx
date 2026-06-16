import AdminDashboardHome from './admin/AdminDashboardHome';
import EmployeeDashboardHome from './employee/EmployeeDashboardHome';
import ManagerDashboardHome from './manager/ManagerDashboardHome';

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const DashboardHome = () => {
  const user = getCurrentUser();
  const role = user?.role || user?.roles?.[0]?.name || 'user';

  if (role === 'user') {
    return <EmployeeDashboardHome />;
  }

  if (role === 'manager') {
    return <ManagerDashboardHome />;
  }

  return <AdminDashboardHome />;
};

export default DashboardHome;
