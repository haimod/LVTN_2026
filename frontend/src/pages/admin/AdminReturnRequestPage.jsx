import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckCircleOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;
const apiOrigin = axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '');

const statusMap = {
  pending: { color: 'gold', text: 'Chờ admin nhận' },
  confirmed: { color: 'green', text: 'Đã nhận lại' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const renderImage = (path, name) => {
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
      alt={name}
      style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
    />
  );
};

const getReturnStatus = (record) => (record.status === 'returned' && record.returned_at ? 'confirmed' : 'pending');

const AdminReturnRequestPage = ({ defaultStatus = 'pending' }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: defaultStatus,
    search: '',
  });
  const [confirmingRecord, setConfirmingRecord] = useState(null);
  const [confirmForm] = Form.useForm();

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/return-requests', {
        params: {
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải danh sách phiếu thu hồi' });
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  const stats = useMemo(() => requests.reduce((current, item) => {
    const status = getReturnStatus(item);
    current.total += 1;
    current[status] = (current[status] || 0) + 1;
    return current;
  }, { total: 0, pending: 0, confirmed: 0 }), [requests]);

  const openConfirmModal = (record) => {
    confirmForm.resetFields();
    setConfirmingRecord(record);
  };

  const handleConfirmReturn = async () => {
    try {
      const values = await confirmForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/return-requests/${confirmingRecord.id}/confirm`, values);
      notification.success({ message: 'Đã xác nhận nhận lại thiết bị' });
      window.dispatchEvent(new Event('notifications-updated'));
      setConfirmingRecord(null);
      loadRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể xác nhận trả thiết bị';
      notification.error({ message: 'Thao tác bị chặn', description: message });
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 80,
      render: (_, record) => renderImage(record.asset?.image_path, record.asset?.name),
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
      title: 'Người trả',
      key: 'user',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.user?.name || '-'}</span>
          <Text type="secondary">{record.user?.department?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Ghi chú nhân viên',
      dataIndex: 'return_reason',
      key: 'return_reason',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      render: (_, record) => {
        const current = statusMap[getReturnStatus(record)];
        return <Tag color={current.color}>{current.text}</Tag>;
      },
    },
    {
      title: 'Ngày yêu cầu',
      dataIndex: 'return_requested_at',
      key: 'return_requested_at',
      render: formatDateTime,
    },
    {
      title: 'Ngày nhận lại',
      dataIndex: 'returned_at',
      key: 'returned_at',
      render: formatDateTime,
    },
    {
      title: 'Admin nhận',
      key: 'returned_by',
      render: (_, record) => record.returned_by?.name || record.returnedBy?.name || '-',
    },
    {
      title: 'Ghi chú admin',
      dataIndex: 'return_admin_note',
      key: 'return_admin_note',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => {
        if (getReturnStatus(record) !== 'pending') {
          return '-';
        }

        return (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openConfirmModal(record)}>
            Xác nhận nhận
          </Button>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Phiếu thu hồi / trả thiết bị</Title>
        <Text type="secondary">Nhân viên quét QR để gửi yêu cầu trả, admin xác nhận khi đã nhận lại thiết bị thực tế.</Text>
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
              <Text type="secondary">Chờ admin nhận</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.pending}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đã nhận lại</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.confirmed}</Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Tìm mã máy, người trả hoặc ghi chú"
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
            <Button icon={<ReloadOutlined />} onClick={loadRequests}>Làm mới</Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="Chưa có phiếu thu hồi" /> }}
        />
      </Card>

      <Modal
        title={confirmingRecord ? `Nhận lại ${confirmingRecord.asset?.asset_code || ''}` : 'Xác nhận nhận lại thiết bị'}
        open={!!confirmingRecord}
        onOk={handleConfirmReturn}
        onCancel={() => setConfirmingRecord(null)}
        confirmLoading={loading}
        okText="Xác nhận đã nhận"
        cancelText="Hủy"
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <Text type="secondary">
            Sau khi xác nhận, phiếu mượn sẽ đóng và thiết bị quay về kho tổng với trạng thái mới nhập kho.
          </Text>
          <Form form={confirmForm} layout="vertical">
            <Form.Item name="return_admin_note" label="Ghi chú khi nhận lại">
              <Input.TextArea rows={4} placeholder="Tình trạng khi nhận lại, phụ kiện đi kèm, ghi chú nếu có..." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
};

export default AdminReturnRequestPage;
