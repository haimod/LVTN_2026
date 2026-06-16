import { Navigate, Outlet } from 'react-router-dom';

const getCurrentRole = () => {
  try {
    const user = localStorage.getItem('user');
    if (!user) return null;

    const parsed = JSON.parse(user);
    return parsed?.role || parsed?.roles?.[0]?.name || null;
  } catch {
    return null;
  }
};

const RoleGuard = ({ allowedRoles }) => {
  const role = getCurrentRole();

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RoleGuard;
