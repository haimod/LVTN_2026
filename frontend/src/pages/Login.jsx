import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, notification } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axiosInstance from '../utils/axiosInstance';

const { Title } = Typography;

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || '/dashboard';

  const onFinish = async (values) => {
    setIsLoading(true);

    try {
      const response = await axiosInstance.post('/login', values);

      if (response.data.status === 'success') {
        localStorage.setItem('access_token', response.data.access_token);

        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        notification.success({
          message: 'Thành công',
          description: 'Đăng nhập thành công.',
          placement: 'topRight',
          duration: 2,
        });

        navigate(redirectPath, { replace: true });
      }
    } catch (error) {
      const errorMessage = error.response && error.response.data
        ? error.response.data.message
        : 'Không thể kết nối đến máy chủ!';

      notification.error({
        message: 'Lỗi đăng nhập',
        description: errorMessage,
        placement: 'topRight',
        duration: 3,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
      backgroundSize: '30px 30px',
      padding: 16,
    }}>
      <Card style={{ width: 'min(400px, 100%)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderRadius: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#1f2937' }}>Hệ thống quản lý tài sản</Title>
          <p style={{ color: '#6b7280', marginTop: 8 }}>Vui lòng đăng nhập để tiếp tục</p>
        </div>

        <Form
          name="login_form"
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Tài khoản Email</span>}
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không đúng định dạng!' },
            ]}
          >
            <Input prefix={<UserOutlined style={{ color: '#9ca3af' }} />} placeholder="admin@gmail.com" size="large" />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 500 }}>Mật khẩu</span>}
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#9ca3af' }} />} placeholder="Mật khẩu" size="large" />
          </Form.Item>

          <Form.Item style={{ marginTop: 10, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading} style={{ borderRadius: 6, height: 45 }}>
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
