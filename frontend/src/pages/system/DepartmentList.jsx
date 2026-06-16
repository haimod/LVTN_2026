import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, notification, Popconfirm, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';

const DepartmentList = () => {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form] = Form.useForm();

  const fetchDepartments = async () => {
    try {
      const response = await axiosInstance.get('/departments', { params: { search } });
      const data = response.data.data ? response.data.data : response.data;
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Lỗi lấy dữ liệu phòng ban' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get('/users');
      const data = response.data.data ? response.data.data : response.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Không thể lấy danh sách nhân sự', error);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(fetchDepartments, 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(fetchUsers, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showModal = (dept = null) => {
    setEditingDept(dept);
    if (dept) {
      form.setFieldsValue(dept); 
    } else {
      form.resetFields(); 
    }
    setIsModalOpen(true);
  };

  // HÀM 1: Bắt sự kiện Lưu để kiểm tra quyền và hiển thị Pop-up
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Nếu Admin có chọn Trưởng phòng
      if (values.manager_id) {
        // Tìm thông tin chi tiết của người được chọn
        const selectedManager = users.find(u => String(u.id) === String(values.manager_id));
        
        // Người duyệt phải có quyền manager/admin để đồng bộ với QLNS
        const hasApprovalRole = selectedManager?.roles?.some(r => ['manager', 'admin'].includes(r.name));

        if (selectedManager && !hasApprovalRole) {
          Modal.confirm({
            title: 'Xác nhận nâng quyền Manager',
            content: `Nhân viên ${selectedManager.name} chưa có quyền Manager. Để làm người duyệt, hệ thống sẽ nâng quyền nhân viên này lên Manager trước khi lưu phòng ban.`,
            okText: 'Đồng ý nâng quyền & Lưu',
            cancelText: 'Hủy',
            onOk: () => submitData(values, true)
          });
          return; // Dừng việc lưu ngay tại đây để chờ Admin bấm Pop-up
        }
      }
      
      // Nếu không có gì đặc biệt thì lưu thẳng
      submitData(values, false);

    } catch {
      notification.error({ message: 'Vui lòng kiểm tra lại thông tin nhập' });
    }
  };

  // HÀM 2: Gửi API thực tế xuống Backend
  const submitData = async (values, upgradeRole) => {
    setLoading(true);
    // Bọc thêm biến upgrade_role vào gói dữ liệu gửi đi
    const payload = { ...values, upgrade_role: upgradeRole };
    
    try {
      if (editingDept) {
        await axiosInstance.put(`/departments/${editingDept.id}`, payload);
        notification.success({ message: 'Cập nhật phòng ban thành công' });
      } else {
        await axiosInstance.post('/departments', payload);
        notification.success({ message: 'Thêm phòng ban mới thành công' });
      }
      setIsModalOpen(false);
      fetchDepartments();
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Lỗi hệ thống khi lưu';
      notification.error({ message: 'Lỗi xử lý', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/departments/${id}`);
      notification.success({ message: 'Đã xóa phòng ban thành công' });
      fetchDepartments();
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể xóa phòng ban này';
      notification.error({ message: 'Lỗi khi xóa', description: msg });
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { 
      title: 'Tên phòng ban', 
      dataIndex: 'name', 
      key: 'name', 
      render: (text) => <strong style={{ color: '#1890ff' }}>{text}</strong> 
    },
    { 
      title: 'Mã phòng', 
      dataIndex: 'code', 
      key: 'code',
      render: (text) => <span style={{ fontStyle: 'italic', fontWeight: 500 }}>{text}</span>
    },
    { 
      title: 'Trưởng phòng', 
      key: 'manager',
      render: (_, record) => <span>{record.manager ? record.manager.name : 'Chưa bổ nhiệm'}</span>
    },
    { 
      title: 'Số nhân sự', 
      dataIndex: 'users_count', 
      key: 'users_count',
      width: 120,
      align: 'center',
      render: (count) => <span>{count || 0} nhân viên</span>
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true }, 
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => showModal(record)}>Sửa</Button>
          <Popconfirm 
            title="Xóa phòng ban này? Hành động này không thể hoàn tác nếu đã có dữ liệu liên kết!" 
            onConfirm={() => handleDelete(record.id)}
            okText="Đồng ý" cancelText="Hủy"
          >
            <Button danger icon={<DeleteOutlined />}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card 
        title={<span style={{fontSize: '20px'}}>Quản lý Phòng ban</span>} 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>Thêm Phòng ban</Button>}
    >
      <Row style={{ marginBottom: 16 }}>
        <Col>
          <Input.Search 
            placeholder="Tìm theo tên hoặc mã phòng..." 
            allowClear 
            onSearch={(value) => setSearch(value)} 
            style={{ width: 300 }} 
          />
        </Col>
      </Row>

      <Table 
        columns={columns} 
        dataSource={departments} 
        rowKey="id" 
        loading={loading} 
        pagination={{ pageSize: 5 }} 
      />

      <Modal 
        title={editingDept ? "Cập nhật phòng ban" : "Thêm phòng ban mới"} 
        open={isModalOpen} 
        onOk={handleSave} 
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
        okText="Lưu dữ liệu" cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{marginTop: '20px'}}>
          <Form.Item 
            name="name" 
            label="Tên phòng ban" 
            rules={[{ required: true, message: 'Vui lòng nhập tên phòng ban!' }]}
          >
            <Input placeholder="VD: Phòng Công nghệ thông tin" />
          </Form.Item>

          <Form.Item 
            name="code" 
            label="Mã phòng ban (Viết tắt)" 
            rules={[{ required: true, message: 'Vui lòng nhập mã viết tắt!' }]}
          >
            <Input placeholder="VD: IT, HR, MKT" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item 
            name="manager_id" 
            label="Trưởng phòng (Người đứng đầu)"
            extra={!editingDept ? "Tạo phòng ban trước, sau đó điều chuyển nhân sự vào phòng rồi mới có thể bổ nhiệm." : "Chỉ hiển thị nhân sự đang hoạt động thuộc phòng ban này."}
          >
            <Select 
              placeholder={editingDept ? "-- Chọn nhân sự bổ nhiệm --" : "-- Vui lòng tạo phòng trước --"} 
              allowClear
              disabled={!editingDept} 
              showSearch 
              optionFilterProp="children" 
              filterOption={(input, option) => {
                const childrenArray = React.Children.toArray(option?.children);
                const text = childrenArray.join('').toLowerCase();
                return text.includes(input.toLowerCase());
              }}
            >
              {users
                .filter(user => user.is_active === 1) 
                .filter(user => editingDept && user.department_id === editingDept.id) 
                .map(user => (
                  <Select.Option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Mô tả chức năng nhiệm vụ">
            <Input.TextArea rows={3} placeholder="Ghi chú ngắn gọn về vai trò của phòng ban..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DepartmentList;
