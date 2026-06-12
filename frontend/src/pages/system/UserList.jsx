import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, notification, Popconfirm, Card, Tag, Row, Col } from 'antd';
import { UserAddOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';

const UserList = () => {
  const getCurrentUserId = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      const userObj = JSON.parse(userStr);
      return userObj?.id || userObj?.user?.id || userObj?.data?.id || null;
    } catch {
      return null;
    }
  };

  const myId = getCurrentUserId();

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  const [filters, setFilters] = useState({
    search: '',
    role: null,
    department_id: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get('/users', { params: filters });
      const data = response.data.data ? response.data.data : response.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Lỗi lấy dữ liệu nhân sự' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axiosInstance.get('/departments');
      const data = response.data.data ? response.data.data : response.data;
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Không thể lấy danh sách phòng ban', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await axiosInstance.get('/roles');
      const data = response.data.data ? response.data.data : response.data;
      setRoles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi lấy danh sách quyền:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  useEffect(() => {
    fetchDepartments();
    fetchRoles(); 
  }, []);

  const getFirstRoleId = (user) => (
    user.roles && user.roles.length > 0 ? user.roles[0].id : null
  );

  const getManagedDepartment = (userId) => (
    departments.find(dept => String(dept.manager_id) === String(userId))
  );

  const notifyApproverMustBeChanged = (department, actionText) => {
    notification.warning({
      message: 'Cần đổi người duyệt trước',
      description: `Nhân sự này đang là người duyệt của ${department.name}. Vui lòng sang Quản lý Phòng ban bổ nhiệm người khác thay thế trước khi ${actionText}.`,
      duration: 6
    });
  };

  const showModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      const formValues = {
        ...user,
        role_id: getFirstRoleId(user),
        // Ép field password rỗng khi mở Modal sửa để tránh lỗi gửi đè pass cũ
        password: '' 
      };
      form.setFieldsValue(formValues);
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        ...values,
        is_active: editingUser ? editingUser.is_active : 1, 
      };

      if (editingUser) {
        const managedDepartment = getManagedDepartment(editingUser.id);
        const currentRoleId = getFirstRoleId(editingUser);

        if (managedDepartment && String(values.role_id) !== String(currentRoleId)) {
          notifyApproverMustBeChanged(managedDepartment, 'đổi chức vụ');
          return;
        }
      }

      setLoading(true);

      if (editingUser) {
        await axiosInstance.put(`/users/${editingUser.id}`, payload);
        notification.success({ message: 'Cập nhật thành công' });
      } else {
        await axiosInstance.post('/users', payload);
        notification.success({ message: 'Thêm nhân viên mới thành công' });
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      // ĐÓN LỖI TỪ BACKEND TRẢ VỀ (Cái cục 400 ở trên)
      const msg = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin nhập';
      
      // HIỂN THỊ CẢNH BÁO
      notification.error({ 
        message: 'Thao tác bị chặn', 
        description: msg,
        duration: 6 // Cho hiện 6 giây để Admin kịp đọc
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLock = async (record) => {
    try {
      if (record.is_active === 1) {
        const managedDepartment = getManagedDepartment(record.id);
        if (managedDepartment) {
          notifyApproverMustBeChanged(managedDepartment, 'khóa tài khoản');
          return;
        }

        await axiosInstance.delete(`/users/${record.id}`);
        notification.success({ message: 'Đã khóa tài khoản thành công' });
      } else {
        const payload = {
          name: record.name,
          email: record.email,
          department_id: record.department_id,
          role_id: getFirstRoleId(record),
          phone: record.phone,
          is_active: 1
        };
        await axiosInstance.put(`/users/${record.id}`, payload);
        notification.success({ message: 'Đã mở khóa tài khoản thành công' });
      }
      fetchUsers();
   } catch (error) {
      // BẮT LỖI TỪ BACKEND VÀ HIỂN THỊ CHI TIẾT
      const errorMessage = error.response?.data?.message || 'Lỗi khi thay đổi trạng thái';
      
      notification.error({ 
        message: 'Thao tác bị từ chối', 
        description: errorMessage,
        duration: 5, // Cho hiện lâu lâu 5 giây để Admin kịp đọc
      });
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { 
      title: 'Họ tên', 
      dataIndex: 'name', 
      key: 'name',
      render: (text, record) => {
        const isSelf = myId && String(record.id) === String(myId);
        return (
          <Space>
            {text}
            {isSelf && <Tag color="blue">Chính bạn</Tag>}
          </Space>
        );
      }
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { 
      title: 'Phòng ban', 
      key: 'department',
      render: (_, record) => <span>{record.department ? record.department.name : 'Chưa xếp phòng'}</span>
    },
    { 
      title: 'Chức vụ', 
      key: 'roles', 
      render: (_, record) => (
        <>
          {record.roles && record.roles.length > 0 
            ? record.roles.map(role => (
                <Tag 
                  key={role.id} 
                  color={role.name === 'admin' ? 'red' : (role.name === 'manager' ? 'purple' : 'blue')}
                  style={{ textTransform: 'capitalize' }}
                >
                  {role.name}
                </Tag>
              ))
            : <span style={{color: 'gray'}}>Chưa cấp quyền</span>}
        </>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => (
        <Tag color={isActive === 0 ? 'red' : 'green'}> 
          {isActive === 0 ? 'Bị khóa' : 'Hoạt động'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => {
        const isLocked = record.is_active === 0; 
        const isSelf = myId && String(record.id) === String(myId);

        return (
          <Space size="middle">
            <Button icon={<EditOutlined />} onClick={() => showModal(record)}>Sửa</Button>
            {!isSelf && (
              <Popconfirm 
                title={isLocked ? "Mở khóa tài khoản?" : "Khóa tài khoản này?"} 
                onConfirm={() => handleToggleLock(record)}
                okText="Đồng ý" cancelText="Hủy"
              >
                <Button 
                  danger={!isLocked} 
                  type={isLocked ? "default" : "primary"} 
                  icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
                >
                  {isLocked ? 'Mở khóa' : 'Khóa'}
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card 
        title={<span style={{fontSize: '20px'}}>Quản lý Nhân sự</span>} 
        extra={<Button type="primary" icon={<UserAddOutlined />} onClick={() => showModal()}>Thêm Nhân viên</Button>}
    >
      <Row style={{ marginBottom: 16 }} justify="space-between">
        <Col>
          <Space size="middle">
            <Input.Search placeholder="Tìm tên, email, sđt..." allowClear onSearch={(value) => setFilters({ ...filters, search: value })} style={{ width: 280 }} />
            <Select placeholder="Lọc theo Phòng ban" allowClear style={{ width: 200 }} onChange={(value) => setFilters({ ...filters, department_id: value })}>
              {departments.map(dept => <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>)}
            </Select>
            <Select placeholder="Lọc theo Chức vụ" allowClear style={{ width: 150 }} onChange={(value) => setFilters({ ...filters, role: value })}>
              {roles.map(role => <Select.Option key={role.id} value={role.id}>{role.name.charAt(0).toUpperCase() + role.name.slice(1)}</Select.Option>)}
            </Select>
          </Space>
        </Col>
      </Row>

      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={{ pageSize: 5 }} />

      <Modal title={editingUser ? "Cập nhật nhân viên" : "Thêm nhân viên mới"} open={isModalOpen} onOk={handleSave} onCancel={() => setIsModalOpen(false)} confirmLoading={loading} okText="Lưu dữ liệu" cancelText="Hủy" width={600}>
        <Form form={form} layout="vertical" style={{marginTop: '20px'}}>
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập tên!' }]}><Input /></Form.Item>
          
          <Space style={{ display: 'flex', marginBottom: 8 }} align="baseline">
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email lỗi!' }]}><Input disabled={!!editingUser} style={{ width: '260px' }} /></Form.Item>
            
            {/* NÂNG CẤP 1: Bắt buộc đúng 10 số điện thoại */}
            <Form.Item 
                name="phone" 
                label="Số điện thoại" 
                rules={[
                    { required: true, message: 'Nhập SĐT!' },
                    { pattern: /^[0-9]{10}$/, message: 'SĐT phải gồm đúng 10 chữ số!' }
                ]}
            >
                <Input style={{ width: '260px' }} maxLength={10} placeholder="VD: 0912345678" />
            </Form.Item>
          </Space>

          <Form.Item name="department_id" label="Phòng ban" rules={[{ required: true, message: 'Chọn phòng!' }]}>
            <Select placeholder="Chọn phòng ban">
              {departments.map(dept => <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item 
            name="role_id" 
            label="Phân quyền" 
            rules={[{ required: true, message: 'Vui lòng chọn quyền!' }]}
          >
            <Select placeholder="Chọn chức vụ">
              {roles.map(role => (
                <Select.Option key={role.id} value={role.id}>
                   {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* NÂNG CẤP 2: Khung Đổi / Reset Mật khẩu */}
          <Form.Item label={editingUser ? "Mật khẩu (Bỏ trống nếu không đổi)" : "Mật khẩu"} style={{ marginBottom: 0 }}>
            <Space align="baseline">
                <Form.Item 
                    name="password" 
                    rules={!editingUser ? [{ required: true, message: 'Nhập pass!' }] : []}
                >
                    <Input.Password 
                        placeholder={editingUser ? "Chỉ nhập khi cần đổi pass mới" : "Nhập mật khẩu khởi tạo"} 
                        style={{ width: '260px' }} 
                    />
                </Form.Item>
                
                {/* Chỉ hiện nút Reset khi đang mở form Sửa */}
                {editingUser && (
                    <Button 
                        type="dashed" 
                        danger 
                        onClick={() => {
                            form.setFieldsValue({ password: '123456' });
                            notification.info({ 
                              message: 'Sẵn sàng Reset', 
                              description: 'Đã điền mật khẩu mặc định (123456). Vui lòng bấm "Lưu dữ liệu" để xác nhận!',
                              placement: 'top' 
                            });
                        }}
                    >
                        Reset về 123456
                    </Button>
                )}
            </Space>
          </Form.Item>

        </Form>
      </Modal>
    </Card>
  );
};

export default UserList;
