import { Layout, Menu, Button, Avatar, Space, Typography } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  LogoutOutlined,
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
  const user = getCurrentUser();

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
    { key: '/admin/reports', icon: <BarChartOutlined />, label: 'Báo cáo kiểm kê' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sider width={260} theme="light" style={{ borderRight: '1px solid #edf0f5' }}>
        <div style={{ height: 72, padding: '16px 20px', borderBottom: '1px solid #edf0f5', lineHeight: '20px' }}>
          <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Admin Portal</Title>
          <Text type="secondary">Kế toán tài sản</Text>
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
            <Text type="secondary">Xin chào quản trị viên</Text>
            <div style={{ fontWeight: 600, lineHeight: '20px' }}>{user?.name || 'Admin'}</div>
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

export default AdminLayout;
