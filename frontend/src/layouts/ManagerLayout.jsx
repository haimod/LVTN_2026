import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Avatar, Space, Typography } from 'antd';
import {
  AppstoreOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  HistoryOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import axiosInstance from '../utils/axiosInstance';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const ManagerLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    const syncUser = () => setUser(getCurrentUser());
    let ignore = false;

    const refreshProfile = async () => {
      try {
        const response = await axiosInstance.get('/profile');
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          localStorage.setItem('user', JSON.stringify(data));
          setUser(data);
          window.dispatchEvent(new Event('profile-updated'));
        }
      } catch {
        // Giữ dữ liệu localStorage hiện tại nếu profile tạm thời không tải được.
      }
    };

    window.addEventListener('storage', syncUser);
    window.addEventListener('profile-updated', syncUser);
    refreshProfile();

    return () => {
      ignore = true;
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('profile-updated', syncUser);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/logout');
    } finally {
      localStorage.clear();
      navigate('/login');
    }
  };

  const hasApproverFlag = typeof user?.is_department_approver !== 'undefined';
  const isDepartmentApprover = user?.is_department_approver === true || user?.is_department_approver === 1;

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    ...(!hasApproverFlag || isDepartmentApprover ? [
      { key: '/manager/assignment-approvals', icon: <CheckSquareOutlined />, label: 'Duyệt yêu cầu' },
    ] : []),
    { key: '/manager/assignment-requests', icon: <SendOutlined />, label: 'Yêu cầu mượn của tôi' },
    { key: '/employee/handover', icon: <QrcodeOutlined />, label: 'Xác nhận bàn giao' },
    { key: '/manager/employees', icon: <TeamOutlined />, label: 'Nhân viên phòng ban' },
    { key: '/assets/list', icon: <AppstoreOutlined />, label: 'Tài sản phòng ban' },
    { key: '/manager/borrow-history', icon: <HistoryOutlined />, label: 'Lịch sử mượn của tôi' },
    { key: '/manager/profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sider width={250} theme="light" style={{ borderRight: '1px solid #edf0f5' }}>
        <div style={{ height: 72, padding: '16px 20px', borderBottom: '1px solid #edf0f5', lineHeight: '20px' }}>
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Manager Portal</Title>
          <Text type="secondary">Không gian trưởng phòng</Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0, paddingTop: 12 }}
        />
      </Sider>

      <Layout>
        <Header style={{ height: 64, lineHeight: 'normal', padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #edf0f5' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: '20px' }}>
            <Text type="secondary">Xin chào trưởng phòng</Text>
            <div style={{ fontWeight: 600, lineHeight: '20px' }}>{user?.name || 'Manager'}</div>
          </div>

          <Space size="middle">
            <NotificationBell />
            <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>Đăng xuất</Button>
          </Space>
        </Header>

        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ManagerLayout;
