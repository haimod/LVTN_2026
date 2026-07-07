import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Input, notification, Row, Skeleton, Space, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const getRoleName = (user) => user?.role || user?.roles?.[0]?.name || 'user';

const ProfilePage = () => {
  const [form] = Form.useForm();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      setLoading(true);

      try {
        const response = await axiosInstance.get('/profile');
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          setProfile(data);
          form.setFieldsValue({
            name: data?.name,
            email: data?.email,
            phone: data?.phone,
          });
        }
      } catch {
        if (!ignore) {
          notification.error({ title: 'Không thể tải thông tin cá nhân' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      ignore = true;
    };
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
      };

      if (values.password) {
        payload.current_password = values.current_password;
        payload.password = values.password;
        payload.password_confirmation = values.password_confirmation;
      }

      setSaving(true);
      const response = await axiosInstance.put('/profile', payload);
      const updatedProfile = response.data.data ? response.data.data : response.data;

      setProfile(updatedProfile);
      localStorage.setItem('user', JSON.stringify(updatedProfile));
      window.dispatchEvent(new Event('profile-updated'));
      form.setFieldsValue({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      notification.success({ title: 'Đã cập nhật thông tin cá nhân' });
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin.';
      notification.error({ title: 'Không thể cập nhật', description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Thông tin cá nhân</Title>
        <Text type="secondary">Cập nhật thông tin liên hệ và mật khẩu đăng nhập của bạn.</Text>
      </div>

      <Skeleton loading={loading} active paragraph={{ rows: 8 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card bordered={false} style={{ borderRadius: 8 }}>
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
                      <Input placeholder="Nhập họ tên" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: 'Vui lòng nhập email' },
                        { type: 'email', message: 'Email không đúng định dạng' },
                      ]}
                    >
                      <Input placeholder="Nhập email" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="phone"
                      label="Số điện thoại"
                      rules={[{ pattern: /^0[0-9]{9}$/, message: 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0' }]}
                    >
                      <Input placeholder="VD: 0901234567" />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  type="info"
                  showIcon
                  message="Chỉ nhập phần mật khẩu nếu bạn muốn đổi mật khẩu đăng nhập."
                  style={{ marginBottom: 16 }}
                />

                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="current_password"
                      label="Mật khẩu hiện tại"
                      dependencies={['password']}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!getFieldValue('password') || value) {
                              return Promise.resolve();
                            }

                            return Promise.reject(new Error('Vui lòng nhập mật khẩu hiện tại'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password placeholder="Nhập mật khẩu hiện tại" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item name="password" label="Mật khẩu mới" rules={[{ min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}>
                      <Input.Password placeholder="Nhập mật khẩu mới" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="password_confirmation"
                      label="Xác nhận mật khẩu mới"
                      dependencies={['password']}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!getFieldValue('password') || getFieldValue('password') === value) {
                              return Promise.resolve();
                            }

                            return Promise.reject(new Error('Xác nhận mật khẩu mới không khớp'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password placeholder="Nhập lại mật khẩu mới" />
                    </Form.Item>
                  </Col>
                </Row>

                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                  Lưu thay đổi
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Thông tin hệ thống" bordered={false} style={{ borderRadius: 8 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Mã nhân viên">{profile?.id ? `NV-${String(profile.id).padStart(5, '0')}` : '-'}</Descriptions.Item>
                <Descriptions.Item label="Phòng ban">{profile?.department_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Chức vụ">{getRoleName(profile)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Skeleton>
    </Space>
  );
};

export default ProfilePage;
