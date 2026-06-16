import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Avatar, Space, Typography } from 'antd';
import { DashboardOutlined, HistoryOutlined, LogoutOutlined, QrcodeOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
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

const EmployeeLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    const syncUser = () => setUser(getCurrentUser());

    window.addEventListener('storage', syncUser);
    window.addEventListener('profile-updated', syncUser);

    return () => {
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

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
    { key: '/employee/assignment-requests', icon: <SendOutlined />, label: 'Yêu cầu mượn thiết bị' },
    { key: '/employee/handover', icon: <QrcodeOutlined />, label: 'Xác nhận bàn giao' },
    { key: '/employee/borrow-history', icon: <HistoryOutlined />, label: 'Lịch sử mượn' },
    { key: '/employee/profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sider width={240} theme="light" style={{ borderRight: '1px solid #edf0f5' }}>
        <div style={{ height: 72, padding: '16px 20px', borderBottom: '1px solid #edf0f5', lineHeight: '20px' }}>
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Employee Portal</Title>
          <Text type="secondary">Không gian nhân viên</Text>
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
            <Text type="secondary">Xin chào</Text>
            <div style={{ fontWeight: 600, lineHeight: '20px' }}>{user?.name || 'Nhân viên'}</div>
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

export default EmployeeLayout;
