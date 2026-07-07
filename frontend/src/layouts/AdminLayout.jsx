import { useEffect, useState } from 'react';
import { Layout, Menu, Button, Avatar, Space, Typography, Drawer, Grid } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
  RetweetOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import axiosInstance from '../utils/axiosInstance';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [menuOpen, setMenuOpen] = useState(false);

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
    {
      key: 'grp-assets',
      icon: <AppstoreOutlined />,
      label: 'Quản lý tài sản',
      children: [
        { key: '/admin/assets', label: 'Danh sách tài sản' },
        { key: '/admin/assets/categories', label: 'Danh mục thiết bị' },
      ],
    },
    {
      key: 'grp-borrow',
      icon: <FileDoneOutlined />,
      label: 'Quản lý mượn',
      children: [
        { key: '/admin/borrow-requests', label: 'Duyệt mượn & cấp phát' },
        { key: '/admin/emergency-allocations', icon: <ThunderboltOutlined />, label: 'Cấp phát khẩn cấp' },
      ],
    },
    {
      key: 'grp-system',
      icon: <SettingOutlined />,
      label: 'Quản trị hệ thống',
      children: [
        { key: '/admin/users', label: 'Quản lý nhân sự' },
        { key: '/admin/departments', label: 'Quản lý phòng ban' },
      ],
    },
    {
      key: 'grp-maintenance',
      icon: <ToolOutlined />,
      label: 'Xử lý & bảo trì',
      children: [
        { key: '/maintenance/tickets', label: 'Tiếp nhận sự cố' },
        { key: '/maintenance/repairing', label: 'Đang bảo trì' },
        { key: '/maintenance/blacklist', label: 'Thiết bị blacklist' },
      ],
    },
    {
      key: 'grp-retrieval',
      icon: <RetweetOutlined />,
      label: 'Thu hồi & thanh lý',
      children: [
        { key: '/retrieval/requests', label: 'Phiếu thu hồi' },
        { key: '/retrieval/liquidation', label: 'Phiếu thanh lý' },
      ],
    },
    {
      key: 'grp-reports',
      icon: <BarChartOutlined />,
      label: 'Báo cáo & nhật ký',
      children: [
        { key: '/admin/reports', label: 'Báo cáo kiểm kê' },
        { key: '/admin/activity-log', icon: <HistoryOutlined />, label: 'Nhật ký hoạt động' },
      ],
    },
    { key: '/admin/profile', icon: <UserOutlined />, label: 'Thông tin cá nhân' },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    setMenuOpen(false);
  };

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderInlineEnd: 0, paddingTop: 12 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb', minWidth: 0 }}>
      {!isMobile ? (
        <Sider width={260} theme="light" style={{ borderRight: '1px solid #edf0f5' }}>
          <div style={{ height: 72, padding: '16px 20px', borderBottom: '1px solid #edf0f5', lineHeight: '20px' }}>
            <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Admin Portal</Title>
            <Text type="secondary">Kế toán tài sản</Text>
          </div>

          {menu}
        </Sider>
      ) : null}

      <Drawer
        title="Admin Portal"
        placement="left"
        open={isMobile && menuOpen}
        onClose={() => setMenuOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {menu}
      </Drawer>

      <Layout style={{ minWidth: 0 }}>
        <Header style={{ minHeight: 64, height: 'auto', lineHeight: 'normal', padding: isMobile ? '10px 12px' : '0 24px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #edf0f5' }}>
          <Space size={12} align="center" style={{ minWidth: 0 }}>
            {isMobile ? (
              <Button icon={<MenuOutlined />} onClick={() => setMenuOpen(true)} aria-label="Mở menu" />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: '20px', minWidth: 0 }}>
              <Text type="secondary">Xin chào quản trị viên</Text>
              <div style={{ fontWeight: 600, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? 180 : 'none' }}>{user?.name || 'Admin'}</div>
            </div>
          </Space>

          <Space size="middle">
            <NotificationBell />
            {!isMobile ? (
              <Avatar
                style={{ backgroundColor: '#1677ff', cursor: 'pointer' }}
                icon={<UserOutlined />}
                onClick={() => navigate('/admin/profile')}
              />
            ) : null}
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>{isMobile ? '' : 'Đăng xuất'}</Button>
          </Space>
        </Header>

        <Content style={{ padding: isMobile ? 12 : 24, overflow: 'auto', minWidth: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
