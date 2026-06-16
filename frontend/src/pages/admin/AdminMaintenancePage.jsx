import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Image, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckOutlined, PictureOutlined, ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;
const apiOrigin = axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '');

const statusMap = {
  pending: { color: 'gold', text: 'Chờ tiếp nhận' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  done: { color: 'green', text: 'Đã hoàn tất' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const renderImage = (path) => {
  const imageUrl = getImageUrl(path);

  if (!imageUrl) {
    return (
      <div style={{ width: 54, height: 54, border: '1px solid #f0f0f0', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#bfbfbf', background: '#fafafa' }}>
        <PictureOutlined />
      </div>
    );
  }

  return (
    <Image
      width={54}
      height={54}
      src={imageUrl}
      alt="maintenance"
      style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
    />
  );
};

const AdminMaintenancePage = ({ defaultStatus = 'pending' }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: defaultStatus,
    search: '',
  });
  const [completingRecord, setCompletingRecord] = useState(null);
  const [completeForm] = Form.useForm();

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/maintenance-records', {
        params: {
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải danh sách bảo trì' });
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(loadRecords, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const stats = useMemo(() => records.reduce((current, item) => {
    current.total += 1;
    current[item.status] = (current[item.status] || 0) + 1;
    return current;
  }, { total: 0, pending: 0, repairing: 0, done: 0 }), [records]);

  const handleReceive = async (record) => {
    try {
      setLoading(true);
      await axiosInstance.patch(`/maintenance-records/${record.id}/receive`);
      notification.success({ message: 'Đã tiếp nhận xử lý bảo trì' });
      window.dispatchEvent(new Event('notifications-updated'));
      loadRecords();
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể tiếp nhận phiếu bảo trì';
      notification.error({ message: 'Thao tác bị chặn', description: message });
      setLoading(false);
    }
  };

  const openCompleteModal = (record) => {
    completeForm.resetFields();
    setCompletingRecord(record);
  };

  const handleComplete = async () => {
    try {
      const values = await completeForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/maintenance-records/${completingRecord.id}/complete`, values);
      notification.success({ message: 'Đã đóng phiếu bảo trì, thiết bị về kho' });
      window.dispatchEvent(new Event('notifications-updated'));
      setCompletingRecord(null);
      loadRecords();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng nhập chi phí sửa chữa hợp lệ';
      notification.error({ message: 'Không thể đóng phiếu', description: message });
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 80,
      render: (_, record) => renderImage(record.image_path),
    },
    {
      title: 'Thiết bị',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <strong>{record.asset?.asset_code || '-'}</strong>
          <span>{record.asset?.name || '-'}</span>
          <Text type="secondary">{record.asset?.category?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Người báo',
      key: 'reported_by',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.reported_by?.name || record.reportedBy?.name || '-'}</span>
          <Text type="secondary">{record.reported_by?.department?.name || record.reportedBy?.department?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Mô tả lỗi',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
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
      title: 'Người xử lý',
      key: 'handled_by',
      render: (_, record) => record.handled_by?.name || record.handledBy?.name || '-',
    },
    {
      title: 'Chi phí',
      dataIndex: 'repair_cost',
      key: 'repair_cost',
      render: (value) => (value !== null && value !== undefined ? Number(value).toLocaleString('vi-VN') : '-'),
    },
    {
      title: 'Ngày báo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 170,
      render: (_, record) => {
        if (record.status === 'pending') {
          return <Button type="primary" icon={<ToolOutlined />} onClick={() => handleReceive(record)}>Tiếp nhận</Button>;
        }

        if (record.status === 'repairing') {
          return <Button type="primary" icon={<CheckOutlined />} onClick={() => openCompleteModal(record)}>Đóng sửa</Button>;
        }

        return '-';
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Xử lý bảo trì</Title>
        <Text type="secondary">Tiếp nhận sự cố do nhân viên báo qua QR và đóng vòng sửa chữa về kho tổng.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng phiếu đang xem</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.total}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Chờ tiếp nhận</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.pending}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đang bảo trì</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.repairing}</Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Tìm mã máy, người báo hoặc mô tả lỗi"
              allowClear
              enterButton
              onSearch={(value) => setFilters((current) => ({ ...current, search: value.trim() }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              value={filters.status}
              allowClear
              style={{ width: '100%' }}
              placeholder="Lọc trạng thái"
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
              options={Object.entries(statusMap).map(([value, config]) => ({
                value,
                label: config.text,
              }))}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={loadRecords}>Làm mới</Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1250 }}
          locale={{ emptyText: <Empty description="Chưa có phiếu bảo trì" /> }}
        />
      </Card>

      <Modal
        title={completingRecord ? `Đóng sửa ${completingRecord.asset?.asset_code || ''}` : 'Đóng phiếu bảo trì'}
        open={!!completingRecord}
        onOk={handleComplete}
        onCancel={() => setCompletingRecord(null)}
        confirmLoading={loading}
        okText="Hoàn tất sửa chữa"
        cancelText="Hủy"
      >
        <Form form={completeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="repair_cost"
            label="Chi phí sửa chữa"
            rules={[{ required: true, message: 'Vui lòng nhập chi phí sửa chữa' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} addonAfter="VND" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AdminMaintenancePage;
