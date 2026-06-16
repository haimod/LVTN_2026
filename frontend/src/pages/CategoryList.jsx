import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, notification, Popconfirm, Card, Row, Col, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import axiosInstance from '../utils/axiosInstance';

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();

  const currentUser = getCurrentUser();
  const currentRole = currentUser?.role || currentUser?.roles?.[0]?.name;
  const canManageCategories = currentRole === 'admin';

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/categories');
      const data = response.data.data ? response.data.data : response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Lỗi lấy dữ liệu danh mục' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadCategories = async () => {
      try {
        const response = await axiosInstance.get('/categories');
        const data = response.data.data ? response.data.data : response.data;
        if (!ignore) {
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Lỗi lấy dữ liệu danh mục' });
        }
      }
    };

    loadCategories();

    return () => {
      ignore = true;
    };
  }, []);

  const showModal = (category = null) => {
    setEditingCategory(category);
    if (category) {
      form.setFieldsValue({
        name: category.name,
        description: category.description,
      });
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingCategory) {
        await axiosInstance.put(`/categories/${editingCategory.id}`, values);
        notification.success({ message: 'Cập nhật danh mục thành công' });
      } else {
        await axiosInstance.post('/categories', values);
        notification.success({ message: 'Thêm danh mục thành công' });
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (error) {
      const msg = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin nhập';
      notification.error({ message: 'Lỗi lưu danh mục', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/categories/${id}`);
      notification.success({ message: 'Đã xóa danh mục thành công' });
      fetchCategories();
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể xóa danh mục này';
      notification.error({ message: 'Lỗi khi xóa', description: msg });
    }
  };

  const filteredCategories = categories.filter((category) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;

    return [category.name, category.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword));
  });

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: 'Tên danh mục',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong style={{ color: '#1890ff' }}>{text}</strong>,
    },
    {
      title: 'Số tài sản',
      dataIndex: 'assets_count',
      key: 'assets_count',
      width: 120,
      align: 'center',
      render: (count) => <Tag color={count > 0 ? 'blue' : 'default'}>{count || 0}</Tag>,
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
  ];

  if (canManageCategories) {
    columns.push({
      title: 'Thao tác',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EditOutlined style={{ color: '#faad14' }} />} onClick={() => showModal(record)} />
          <Popconfirm
            title="Xóa danh mục này?"
            description="Chỉ xóa được khi danh mục chưa có tài sản."
            onConfirm={() => handleDelete(record.id)}
            okText="Đồng ý"
            cancelText="Hủy"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={(record.assets_count || 0) > 0}
            />
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <Card
      title={<span style={{ fontSize: '20px', fontWeight: 600 }}>Danh mục thiết bị</span>}
      extra={canManageCategories && <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>Thêm Danh mục</Button>}
      style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Input.Search
            placeholder="Tìm tên hoặc mô tả danh mục..."
            allowClear
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 320 }}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchCategories}>Làm mới</Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={filteredCategories}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
      />

      <Modal
        title={editingCategory ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
        okText="Lưu dữ liệu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Nhập tên danh mục!' }]}>
            <Input placeholder="VD: Laptop, Màn hình, Máy in" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Ghi chú ngắn về nhóm thiết bị này..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CategoryList;
