import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Avatar, Space, Typography } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  SwapOutlined,
  ToolOutlined,
  RetweetOutlined,
  SettingOutlined,
  BarChartOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, Outlet } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const Dashboard = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/logout');
    } finally {
      localStorage.clear();
      navigate('/login');
    }
  };

  // Hàm xử lý khi click vào 1 dòng trên Menu
  const handleMenuClick = (e) => {
    // e.key chính là đường dẫn mình đã khai báo ở dưới, ví dụ: '/assets'
    navigate(e.key); 
  };

  // ĐÂY LÀ BẢN THIẾT KẾ 7 MODULE CỦA BẠN
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '1. Tổng quan',
    },
    {
      key: 'grp-assets',
      icon: <AppstoreOutlined />,
      label: '2. Quản lý Tài sản',
      children: [
        { key: '/assets/list', label: 'Danh sách tài sản' },
        { key: '/assets/in-stock', label: 'Tài sản tồn kho' },
        { key: '/assets/categories', label: 'Danh mục thiết bị' },
      ],
    },
    {
      key: 'grp-allocation',
      icon: <SwapOutlined />,
      label: '3. Quản lý Cấp phát',
      children: [
        { key: '/allocations/pending', label: 'Yêu cầu chờ xử lý' },
        { key: '/allocations/history', label: 'Lịch sử cấp phát' },
        { key: '/allocations/emergency', label: '⚡ Cấp phát khẩn cấp', danger: true }, // AntD hỗ trợ tô đỏ nút này
      ],
    },
    {
      key: 'grp-maintenance',
      icon: <ToolOutlined />,
      label: '4. Xử lý & Bảo trì',
      children: [
        { key: '/maintenance/tickets', label: 'Tiếp nhận sự cố' },
        { key: '/maintenance/repairing', label: 'Đang bảo trì' },
        { key: '/maintenance/blacklist', label: 'Thiết bị Blacklist' },
      ],
    },
    {
      key: 'grp-retrieval',
      icon: <RetweetOutlined />,
      label: '5. Thu hồi & Thanh lý',
      children: [
        { key: '/retrieval/requests', label: 'Phiếu thu hồi' },
        { key: '/retrieval/liquidation', label: 'Phiếu thanh lý' },
      ],
    },
    {
      key: 'grp-system',
      icon: <SettingOutlined />,
      label: '6. Quản trị Hệ thống',
      children: [
        { key: '/system/users', label: 'Quản lý Nhân sự' },
        { key: '/system/departments', label: 'Quản lý Phòng ban' },
      ],
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '7. Báo cáo kiểm kê',
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* CỘT SIDEBAR MENU */}
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light" width={260}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            {collapsed ? 'AS' : 'ASSET SYSTEM'}
          </Title>
        </div>
        
        <Menu
          theme="light"
          mode="inline"
          defaultSelectedKeys={['/dashboard']}
          items={menuItems}
          onClick={handleMenuClick} // Bắt sự kiện chuyển trang
        />
      </Sider>

      {/* KHU VỰC BÊN PHẢI */}
      <Layout>
        {/* HEADER */}
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          
          <Space size="large">
            <span style={{ fontWeight: 500 }}>Xin chào, Admin</span>
            <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
            <Button danger icon={<LogoutOutlined />} onClick={handleLogout}>
              Đăng xuất
            </Button>
          </Space>
        </Header>

        {/* CONTENT CHÍNH: Nơi hiển thị các trang con */}
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8, minHeight: 280, overflow: 'auto' }}>
            {/* THẺ OUTLET: Đây là cái "Lỗ hổng" để React Router bơm nội dung các trang con vào */}
            <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;