import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, notification, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const statusMap = {
  waiting: { color: 'gold', text: 'Chờ xác nhận' },
  active: { color: 'green', text: 'Đang mượn' },
  returned: { color: 'default', text: 'Đã trả' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');

const AdminEmergencyAllocationPage = () => {
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    const fetchDependencies = async () => {
      setLoading(true);

      try {
        const [usersRes, assetsRes, allocationsRes] = await Promise.all([
          axiosInstance.get('/users'),
          axiosInstance.get('/assets', { params: { status: 'new', department_id: 'warehouse' } }),
          axiosInstance.get('/emergency-allocations'),
        ]);

        if (!ignore) {
          const userData = usersRes.data.data ? usersRes.data.data : usersRes.data;
          const assetData = assetsRes.data.data ? assetsRes.data.data : assetsRes.data;
          const allocationData = allocationsRes.data.data ? allocationsRes.data.data : allocationsRes.data;

          setUsers(Array.isArray(userData) ? userData.filter((user) => user.is_active === 1 || user.is_active === true) : []);
          setAssets(Array.isArray(assetData) ? assetData : []);
          setAllocations(Array.isArray(allocationData) ? allocationData : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Không thể tải dữ liệu cấp phát khẩn cấp' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDependencies();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const refreshData = () => setReloadKey((current) => current + 1);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await axiosInstance.post('/emergency-allocations', values);
      notification.success({ message: 'Đã tạo phiếu cấp phát khẩn cấp' });
      form.resetFields();
      refreshData();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin cấp phát.';
      notification.error({ message: 'Không thể cấp phát khẩn cấp', description: message });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id) => <strong>BG-{String(id).padStart(5, '0')}</strong>,
    },
    {
      title: 'Thiết bị',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.asset?.asset_code || '-'}</span>
          <Text type="secondary">{record.asset?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Người nhận',
      key: 'user',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.user?.name || '-'}</span>
          <Text type="secondary">{record.user?.department?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => {
        const current = statusMap[status] || { color: 'default', text: status || '-' };
        return <Tag color={current.color}>{current.text}</Tag>;
      },
    },
    {
      title: 'Người cấp phát',
      key: 'assigned_by',
      render: (_, record) => record.assigned_by?.name || '-',
    },
    {
      title: 'Thời điểm cấp',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: formatDateTime,
    },
    {
      title: 'Lý do',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value) => value || '-',
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Cấp phát khẩn cấp</Title>
        <Text type="secondary">Bỏ qua quy trình tạo đơn, nhưng vẫn tạo phiếu bàn giao chờ nhân viên xác nhận qua QR.</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="user_id"
                label="Nhân viên nhận"
                rules={[{ required: true, message: 'Vui lòng chọn nhân viên nhận thiết bị' }]}
              >
                <Select
                  placeholder="Chọn nhân viên"
                  showSearch
                  optionFilterProp="label"
                  options={users.map((user) => ({
                    value: user.id,
                    label: `${user.name} - ${user.department?.name || 'Chưa có phòng ban'}`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="asset_id"
                label="Thiết bị đang rảnh"
                rules={[{ required: true, message: 'Vui lòng chọn thiết bị cấp phát' }]}
              >
                <Select
                  placeholder="Chọn thiết bị"
                  showSearch
                  optionFilterProp="label"
                  options={assets.map((asset) => ({
                    value: asset.id,
                    label: `${asset.asset_code} - ${asset.name} (${asset.category?.name || 'Không rõ danh mục'})`,
                  }))}
                  notFoundContent="Không có thiết bị rảnh"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="reason"
                label="Lý do khẩn cấp"
                rules={[
                  { required: true, message: 'Vui lòng nhập lý do cấp phát khẩn cấp' },
                  { min: 10, message: 'Lý do cần tối thiểu 10 ký tự' },
                ]}
              >
                <Input.TextArea rows={1} placeholder="VD: Thiết bị hỏng đột xuất, cần máy thay thế ngay..." />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={saving} onClick={handleCreate}>
              Tạo phiếu khẩn cấp
            </Button>
            <Button icon={<ReloadOutlined />} onClick={refreshData}>Làm mới</Button>
          </Space>
        </Form>
      </Card>

      <Card title="Phiếu cấp phát khẩn cấp gần đây" bordered={false} style={{ borderRadius: 8 }}>
        <Table
          columns={columns}
          dataSource={allocations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1050 }}
        />
      </Card>
    </Space>
  );
};

export default AdminEmergencyAllocationPage;
