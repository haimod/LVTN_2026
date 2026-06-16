import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, notification, Row, Select, Table, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const statusMap = {
  pending: { color: 'gold', text: 'Chờ trưởng phòng duyệt' },
  mgr_approved: { color: 'blue', text: 'Chờ admin cấp phát' },
  approved: { color: 'green', text: 'Đã duyệt cấp phát' },
  rejected: { color: 'red', text: 'Đã từ chối' },
  cancelled: { color: 'default', text: 'Đã hủy' },
  out_of_stock: { color: 'orange', text: 'Chờ nhập kho' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const AssignmentRequestPage = ({ requestScope = null, title = 'Yêu cầu mượn thiết bị' }) => {
  const [requests, setRequests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const user = getCurrentUser();
  const role = user?.role || user?.roles?.[0]?.name || 'user';
  const isSelfRequestView = role === 'user' || requestScope === 'mine';

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/assignment-requests', {
        params: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(requestScope ? { scope: requestScope } : {}),
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Lỗi lấy danh sách yêu cầu' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadRequests = async () => {
      try {
        const response = await axiosInstance.get('/assignment-requests', {
          params: {
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(requestScope ? { scope: requestScope } : {}),
          },
        });
        const data = response.data.data ? response.data.data : response.data;
        if (!ignore) {
          setRequests(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Lỗi lấy danh sách yêu cầu' });
        }
      }
    };

    loadRequests();

    return () => {
      ignore = true;
    };
  }, [statusFilter, requestScope]);

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
          notification.error({ message: 'Lỗi lấy danh mục thiết bị' });
        }
      }
    };

    loadCategories();

    return () => {
      ignore = true;
    };
  }, []);

  const openCreateModal = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await axiosInstance.post('/assignment-requests', values);
      notification.success({ message: 'Đã gửi yêu cầu mượn thiết bị' });
      setIsModalOpen(false);
      fetchRequests();
    } catch (error) {
      const msg = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin yêu cầu';
      notification.error({ message: 'Không thể gửi yêu cầu', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = (status) => {
    const current = statusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
  };

  const columns = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id) => <strong>YC-{String(id).padStart(5, '0')}</strong>,
    },
    {
      title: 'Thiết bị cần mượn',
      key: 'category',
      render: (_, record) => record.category?.name || '-',
    },
    ...(!isSelfRequestView ? [
      {
        title: 'Người gửi',
        key: 'requester',
        render: (_, record) => record.requester?.name || '-',
      },
      {
        title: 'Phòng ban',
        key: 'department',
        render: (_, record) => record.requester?.department?.name || '-',
      },
    ] : []),
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: renderStatus,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Phản hồi',
      key: 'note',
      ellipsis: true,
      render: (_, record) => record.manager_note || record.admin_note || '-',
    },
  ];

  return (
    <Card
      title={<span style={{ fontSize: 20, fontWeight: 600 }}>{title}</span>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Tạo yêu cầu</Button>}
      style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Select
            placeholder="Lọc trạng thái"
            allowClear
            value={statusFilter}
            style={{ width: 220 }}
            onChange={setStatusFilter}
          >
            {Object.entries(statusMap).map(([value, config]) => (
              <Select.Option key={value} value={value}>{config.text}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={fetchRequests}>Làm mới</Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 1000 }}
      />

      <Modal
        title="Tạo yêu cầu mượn thiết bị"
        open={isModalOpen}
        onOk={handleCreate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        width={620}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            name="category_id"
            label="Loại thiết bị cần mượn"
            rules={[{ required: true, message: 'Vui lòng chọn loại thiết bị!' }]}
          >
            <Select placeholder="-- Chọn danh mục thiết bị --" showSearch optionFilterProp="children">
              {categories.map((category) => (
                <Select.Option key={category.id} value={category.id}>{category.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do mượn"
            rules={[
              { required: true, message: 'Vui lòng nhập lý do mượn!' },
              { min: 10, message: 'Lý do cần tối thiểu 10 ký tự.' },
            ]}
          >
            <Input.TextArea rows={4} placeholder="VD: Cần laptop để phục vụ dự án trong tháng này..." />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssignmentRequestPage;
