import AdminLayout from '../layouts/AdminLayout';
import EmployeeLayout from '../layouts/EmployeeLayout';
import ManagerLayout from '../layouts/ManagerLayout';

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const user = getCurrentUser();
  const role = user?.role || user?.roles?.[0]?.name || 'user';

  if (role === 'user') {
    return <EmployeeLayout />;
  }

  if (role === 'manager') {
    return <ManagerLayout />;
  }

  return <AdminLayout />;
};

export default Dashboard;
