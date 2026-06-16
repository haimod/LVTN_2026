import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    // 1. Lục tìm xem trong máy có Thẻ Nhân Viên (access_token) không
    const token = localStorage.getItem('access_token');

    // 2. Nếu CÓ thẻ -> Cho phép đi tiếp vào các trang bên trong (Outlet)
    // Nếu KHÔNG có thẻ -> Quay xe, đá văng về trang đăng nhập
    return token ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
