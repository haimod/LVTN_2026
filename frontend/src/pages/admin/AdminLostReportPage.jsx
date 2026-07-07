import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Empty, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;
const apiOrigin = axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '');

const statusMap = {
  pending: { color: 'gold', text: 'Chờ xử lý' },
  recovered: { color: 'green', text: 'Đã tìm lại' },
  permanently_lost: { color: 'red', text: 'Mất vĩnh viễn' },
};

const assetStatusMap = {
  new: { color: 'blue', text: 'Trong kho' },
  in_use: { color: 'green', text: 'Đang sử dụng' },
  waiting: { color: 'gold', text: 'Chờ bàn giao/xử lý' },
  repairing: { color: 'orange', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Mất vĩnh viễn' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const resolutionOptions = [
  { value: 'recovered', label: 'Đã tìm lại thiết bị' },
  { value: 'permanently_lost', label: 'Xác nhận mất vĩnh viễn' },
];

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

const AdminLostReportPage = ({ defaultStatus = 'pending' }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: defaultStatus,
    search: '',
  });
  const [resolvingReport, setResolvingReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [resolveForm] = Form.useForm();

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/lost-reports', {
        params: {
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setReports(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải danh sách báo mất' });
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(loadReports, 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  const stats = useMemo(() => reports.reduce((current, item) => {
    current.total += 1;
    current[item.status] = (current[item.status] || 0) + 1;
    return current;
  }, { total: 0, pending: 0, recovered: 0, permanently_lost: 0 }), [reports]);

  const openResolveModal = (record) => {
    resolveForm.resetFields();
    resolveForm.setFieldsValue({ resolution: 'recovered' });
    setViewingReport(null);
    setResolvingReport(record);
  };

  const renderLostStatus = (status) => {
    const current = statusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
  };

  const renderAssetStatus = (status) => {
    const current = assetStatusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
  };

  const handleResolve = async () => {
    try {
      const values = await resolveForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/lost-reports/${resolvingReport.id}/resolve`, values);
      notification.success({ message: 'Đã xử lý phiếu báo mất' });
      window.dispatchEvent(new Event('notifications-updated'));
      setResolvingReport(null);
      setViewingReport(null);
      loadReports();
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể xử lý phiếu báo mất';
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
      title: 'Mô tả mất',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: renderLostStatus,
    },
    {
      title: 'Người xử lý',
      key: 'handled_by',
      render: (_, record) => record.handled_by?.name || record.handledBy?.name || '-',
    },
    {
      title: 'Ghi chú admin',
      dataIndex: 'admin_note',
      key: 'admin_note',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Ngày báo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Ngày xử lý',
      dataIndex: 'resolved_at',
      key: 'resolved_at',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 220,
      render: (_, record) => {
        return (
          <Space wrap>
            <Button icon={<EyeOutlined />} onClick={() => setViewingReport(record)}>
              Chi tiết
            </Button>
            {record.status === 'pending' ? (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openResolveModal(record)}>
            Xử lý
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Thiết bị báo mất / blacklist</Title>
        <Text type="secondary">Admin tiếp nhận báo mất, xác nhận tìm lại hoặc đưa thiết bị vào blacklist. Giấy tờ và bồi thường xử lý trực tiếp ngoài hệ thống.</Text>
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
              <Text type="secondary">Chờ xử lý</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.pending}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Blacklist</Text>
              <Title level={2} style={{ margin: 0 }}>{stats.permanently_lost}</Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Tìm mã máy, người báo hoặc mô tả mất"
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
            <Button icon={<ReloadOutlined />} onClick={loadReports}>Làm mới</Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="Chưa có phiếu báo mất" /> }}
        />
      </Card>

      <Modal
        title={viewingReport ? `Chi tiết báo mất ${viewingReport.asset?.asset_code || ''}` : 'Chi tiết báo mất'}
        open={!!viewingReport}
        onCancel={() => setViewingReport(null)}
        footer={[
          <Button key="close" onClick={() => setViewingReport(null)}>Đóng</Button>,
          viewingReport?.status === 'pending' ? (
            <Button key="resolve" type="primary" icon={<CheckCircleOutlined />} onClick={() => openResolveModal(viewingReport)}>
              Xử lý
            </Button>
          ) : null,
        ]}
        width={820}
      >
        {viewingReport ? (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                {getImageUrl(viewingReport.asset?.image_path) ? (
                  <Image
                    src={getImageUrl(viewingReport.asset?.image_path)}
                    alt={viewingReport.asset?.name || 'asset'}
                    width="100%"
                    height={220}
                    style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
                  />
                ) : (
                  <div style={{ height: 220, border: '1px solid #f0f0f0', borderRadius: 8, display: 'grid', placeItems: 'center', color: '#bfbfbf', background: '#fafafa' }}>
                    <Space direction="vertical" align="center">
                      <PictureOutlined style={{ fontSize: 28 }} />
                      <Text type="secondary">Không có ảnh thiết bị</Text>
                    </Space>
                  </div>
                )}
              </Col>
              <Col xs={24} md={16}>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Mã phiếu">BM-{String(viewingReport.id).padStart(5, '0')}</Descriptions.Item>
                  <Descriptions.Item label="Kết quả">{renderLostStatus(viewingReport.status)}</Descriptions.Item>
                  <Descriptions.Item label="Tài sản">{viewingReport.asset?.asset_code || '-'} - {viewingReport.asset?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Danh mục">{viewingReport.asset?.category?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Trạng thái tài sản">{renderAssetStatus(viewingReport.asset?.status)}</Descriptions.Item>
                  <Descriptions.Item label="Người báo">{viewingReport.reported_by?.name || viewingReport.reportedBy?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Phòng ban người báo">{viewingReport.reported_by?.department?.name || viewingReport.reportedBy?.department?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày báo">{formatDateTime(viewingReport.created_at)}</Descriptions.Item>
                  <Descriptions.Item label="Người xử lý">{viewingReport.handled_by?.name || viewingReport.handledBy?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày xử lý">{formatDateTime(viewingReport.resolved_at)}</Descriptions.Item>
                  <Descriptions.Item label="Phiếu mượn">{viewingReport.assignment?.id ? `PM-${String(viewingReport.assignment.id).padStart(5, '0')}` : '-'}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>

            <Card size="small" title="Mô tả mất">
              <Text>{viewingReport.description || '-'}</Text>
            </Card>

            <Card size="small" title="Ghi chú xử lý của admin">
              <Text>{viewingReport.admin_note || '-'}</Text>
            </Card>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title={resolvingReport ? `Xử lý báo mất ${resolvingReport.asset?.asset_code || ''}` : 'Xử lý báo mất'}
        open={!!resolvingReport}
        onOk={handleResolve}
        onCancel={() => setResolvingReport(null)}
        confirmLoading={loading}
        okText="Xác nhận xử lý"
        cancelText="Hủy"
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <Text type="secondary">
            Nếu tìm lại, thiết bị sẽ về kho tổng. Nếu xác nhận mất vĩnh viễn, thiết bị được đưa vào blacklist và QR chỉ còn hiển thị cảnh báo.
          </Text>
          <Form form={resolveForm} layout="vertical">
            <Form.Item
              name="resolution"
              label="Kết quả xử lý"
              rules={[{ required: true, message: 'Vui lòng chọn kết quả xử lý' }]}
            >
              <Select options={resolutionOptions} />
            </Form.Item>

            <Form.Item
              name="admin_note"
              label="Ghi chú xử lý"
              rules={[
                { required: true, message: 'Vui lòng nhập ghi chú xử lý' },
                { min: 5, message: 'Ghi chú cần tối thiểu 5 ký tự' },
              ]}
            >
              <Input.TextArea rows={4} placeholder="Ví dụ: đã nhận thông tin trực tiếp, đã kiểm tra vị trí, đã chốt tình trạng..." />
            </Form.Item>
          </Form>
          <Text type="secondary">
            <ExclamationCircleOutlined /> Không lưu hồ sơ bồi thường hoặc giấy tờ trong hệ thống.
          </Text>
        </Space>
      </Modal>
    </Space>
  );
};

export default AdminLostReportPage;
