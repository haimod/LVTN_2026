import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Empty, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, EyeOutlined, HistoryOutlined, PictureOutlined, QrcodeOutlined, RollbackOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;
const apiOrigin = axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '');

const statusMap = {
  waiting: { color: 'gold', text: 'Chờ xác nhận' },
  active: { color: 'green', text: 'Đang mượn' },
  returned: { color: 'default', text: 'Đã trả' },
};

const lostStatusMap = {
  pending: { color: 'volcano', text: 'Đang điều tra mất' },
  recovered: { color: 'green', text: 'Đã tìm lại' },
  permanently_lost: { color: 'black', text: 'Mất vĩnh viễn' },
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

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');

const isReturnOverdue = (record) => (
  record.expected_return_date
  && ['waiting', 'active'].includes(record.status)
  && !record.return_requested_at
  && dayjs(record.expected_return_date).isBefore(dayjs(), 'day')
);

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const renderImage = (path, name) => {
  const imageUrl = getImageUrl(path);

  if (!imageUrl) {
    return (
      <div style={{ width: 56, height: 56, border: '1px solid #f0f0f0', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#bfbfbf', background: '#fafafa' }}>
        <PictureOutlined />
      </div>
    );
  }

  return (
    <Image
      width={56}
      height={56}
      src={imageUrl}
      alt={name}
      style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
    />
  );
};

const BorrowHistoryPage = () => {
  const navigate = useNavigate();
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: null,
    search: '',
  });
  const [lostReportRecord, setLostReportRecord] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [reportingLost, setReportingLost] = useState(false);
  const [lostForm] = Form.useForm();

  useEffect(() => {
    let ignore = false;

    const loadHistories = async () => {
      try {
        const response = await axiosInstance.get('/borrow-history', {
          params: {
            status: filters.status || undefined,
            search: filters.search || undefined,
          },
        });
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          setHistories(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Không thể tải lịch sử mượn thiết bị' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadHistories();

    return () => {
      ignore = true;
    };
  }, [filters.status, filters.search]);

  const reloadHistories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/borrow-history', {
        params: {
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setHistories(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải lịch sử mượn thiết bị' });
    } finally {
      setLoading(false);
    }
  };

  const openLostReportModal = (record) => {
    lostForm.resetFields();
    setViewingHistory(null);
    setLostReportRecord(record);
  };

  const handleReportLost = async () => {
    if (!lostReportRecord?.id) {
      notification.warning({ message: 'Vui lòng chọn thiết bị cần báo mất' });
      return;
    }

    try {
      const values = await lostForm.validateFields();
      setReportingLost(true);
      await axiosInstance.post('/lost-reports/report', {
        assignment_id: lostReportRecord.id,
        description: values.description,
      });
      notification.success({ message: 'Đã gửi phiếu báo mất thiết bị' });
      window.dispatchEvent(new Event('notifications-updated'));
      setLostReportRecord(null);
      reloadHistories();
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể gửi phiếu báo mất';
      notification.error({ message: 'Thao tác bị chặn', description: message });
    } finally {
      setReportingLost(false);
    }
  };

  const getLostReport = (record) => record?.lost_report || record?.lostReport || null;

  const renderLostStatus = (status) => {
    const current = lostStatusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
  };

  const renderAssetStatus = (status) => {
    const current = assetStatusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
  };

  const renderBorrowStatus = (record) => {
    const current = statusMap[record.status] || { color: 'default', text: record.status || '-' };
    const lostReport = getLostReport(record);

    return (
      <Space direction="vertical" size={4} align="center">
        <Tag color={current.color}>{current.text}</Tag>
        {lostReport ? renderLostStatus(lostReport.status) : null}
      </Space>
    );
  };

  const stats = useMemo(() => histories.reduce((current, item) => {
    current.total += 1;

    if (item.status === 'waiting') {
      current.waiting += 1;
    }

    if (item.status === 'active') {
      current.active += 1;
    }

    if (item.status === 'returned') {
      current.returned += 1;
    }

    return current;
  }, { total: 0, waiting: 0, active: 0, returned: 0 }), [histories]);

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
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (_, record) => renderBorrowStatus(record),
    },
    {
      title: 'Ngày cấp phát',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: formatDateTime,
    },
    {
      title: 'Dự kiến trả',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{formatDate(record.expected_return_date)}</span>
          {isReturnOverdue(record) ? <Tag color="red">Quá hạn</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Ngày xác nhận',
      dataIndex: 'confirmed_at',
      key: 'confirmed_at',
      render: formatDateTime,
    },
    {
      title: 'Ngày trả',
      dataIndex: 'returned_at',
      key: 'returned_at',
      render: formatDateTime,
    },
    {
      title: 'Người cấp phát',
      key: 'assigned_by',
      render: (_, record) => record.assigned_by?.name || '-',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      width: 280,
      render: (_, record) => {
        const lostReport = getLostReport(record);
        const detailButton = (
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewingHistory(record)}>
            Chi tiết
          </Button>
        );

        if (record.status === 'waiting') {
          return (
            <Space size="small" wrap>
              {detailButton}
              <Button
                size="small"
                type="primary"
                icon={<QrcodeOutlined />}
                disabled={!record.asset?.uuid}
                onClick={() => navigate(`/employee/handover?code=${encodeURIComponent(record.asset.uuid)}`)}
              >
                Xác nhận
              </Button>
            </Space>
          );
        }

        if (record.status === 'active') {
          if (lostReport) {
            return (
              <Space size="small" wrap>
                {detailButton}
                {renderLostStatus(lostReport.status)}
              </Space>
            );
          }

          if (record.return_requested_at) {
            return (
              <Space size="small" wrap>
                {detailButton}
                <Tag color="blue">Chờ admin nhận</Tag>
              </Space>
            );
          }

          if (record.asset?.status === 'under_investigation') {
            return (
              <Space size="small" wrap>
                {detailButton}
                <Tag color="volcano">Đang điều tra</Tag>
              </Space>
            );
          }

          if (record.asset?.status === 'permanently_lost') {
            return (
              <Space size="small" wrap>
                {detailButton}
                <Tag color="black">Đã báo mất</Tag>
              </Space>
            );
          }

          return (
            <Space size="small" wrap>
              {detailButton}
              <Button
                size="small"
                icon={<ToolOutlined />}
                disabled={!record.asset?.uuid}
                onClick={() => navigate('/employee/handover')}
              >
                Quét QR
              </Button>
              <Button
                size="small"
                danger
                icon={<ExclamationCircleOutlined />}
                onClick={() => openLostReportModal(record)}
              >
                Báo mất
              </Button>
            </Space>
          );
        }

        return detailButton;
      },
    },
  ];

  const renderHistoryDetailModal = () => {
    if (!viewingHistory) {
      return null;
    }

    const lostReport = getLostReport(viewingHistory);

    return (
      <Modal
        title={`Chi tiết phiếu mượn ${viewingHistory.asset?.asset_code || ''}`}
        open={!!viewingHistory}
        onCancel={() => setViewingHistory(null)}
        footer={<Button onClick={() => setViewingHistory(null)}>Đóng</Button>}
        width={820}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              {getImageUrl(viewingHistory.asset?.image_path) ? (
                <Image
                  src={getImageUrl(viewingHistory.asset?.image_path)}
                  alt={viewingHistory.asset?.name || 'asset'}
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
                <Descriptions.Item label="Mã phiếu">PM-{String(viewingHistory.id).padStart(5, '0')}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái mượn">{renderBorrowStatus(viewingHistory)}</Descriptions.Item>
                <Descriptions.Item label="Tài sản">{viewingHistory.asset?.asset_code || '-'} - {viewingHistory.asset?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Danh mục">{viewingHistory.asset?.category?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái tài sản">{renderAssetStatus(viewingHistory.asset?.status)}</Descriptions.Item>
                <Descriptions.Item label="Ngày cấp phát">{formatDateTime(viewingHistory.assigned_at)}</Descriptions.Item>
                <Descriptions.Item label="Ngày dự kiến trả">{formatDate(viewingHistory.expected_return_date)}</Descriptions.Item>
                <Descriptions.Item label="Ngày xác nhận">{formatDateTime(viewingHistory.confirmed_at)}</Descriptions.Item>
                <Descriptions.Item label="Ngày trả/đóng phiếu">{formatDateTime(viewingHistory.returned_at)}</Descriptions.Item>
                <Descriptions.Item label="Người cấp phát">{viewingHistory.assigned_by?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Người nhận lại">{viewingHistory.returned_by?.name || viewingHistory.returnedBy?.name || '-'}</Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>

          <Card size="small" title="Ghi chú phiếu mượn">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>Ghi chú cấp phát: {viewingHistory.note || '-'}</Text>
              <Text>Lý do yêu cầu trả: {viewingHistory.return_reason || '-'}</Text>
              <Text>Ghi chú admin khi nhận lại: {viewingHistory.return_admin_note || '-'}</Text>
            </Space>
          </Card>

          {lostReport ? (
            <Card size="small" title="Thông tin báo mất">
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Mã phiếu báo mất">BM-{String(lostReport.id).padStart(5, '0')}</Descriptions.Item>
                <Descriptions.Item label="Kết quả">{renderLostStatus(lostReport.status)}</Descriptions.Item>
                <Descriptions.Item label="Ngày báo">{formatDateTime(lostReport.created_at)}</Descriptions.Item>
                <Descriptions.Item label="Ngày xử lý">{formatDateTime(lostReport.resolved_at)}</Descriptions.Item>
                <Descriptions.Item label="Người xử lý">{lostReport.handled_by?.name || lostReport.handledBy?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Mô tả mất">{lostReport.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="Ghi chú admin">{lostReport.admin_note || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          ) : null}
        </Space>
      </Modal>
    );
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Lịch sử mượn thiết bị</Title>
        <Text type="secondary">Theo dõi các thiết bị bạn đã được cấp phát, đang sử dụng hoặc đã hoàn trả.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng lượt mượn</Text>
              <Space align="center">
                <HistoryOutlined style={{ color: '#1677ff', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.total}</Title>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đang mượn</Text>
              <Space align="center">
                <CheckCircleOutlined style={{ color: '#389e0d', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.active}</Title>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Chờ xác nhận</Text>
              <Space align="center">
                <ClockCircleOutlined style={{ color: '#d48806', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.waiting}</Title>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đã trả</Text>
              <Space align="center">
                <RollbackOutlined style={{ color: '#595959', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.returned}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={10}>
            <Input.Search
              placeholder="Tìm mã, tên hoặc danh mục thiết bị"
              allowClear
              enterButton
              onSearch={(value) => {
                setLoading(true);
                setFilters((prev) => ({ ...prev, search: value.trim() }));
              }}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              value={filters.status}
              style={{ width: '100%' }}
              onChange={(value) => {
                setLoading(true);
                setFilters((prev) => ({ ...prev, status: value }));
              }}
              options={Object.entries(statusMap).map(([value, config]) => ({
                value,
                label: config.text,
              }))}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={histories}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1380 }}
          locale={{ emptyText: <Empty description="Chưa có lịch sử mượn thiết bị" /> }}
        />
      </Card>

      {renderHistoryDetailModal()}

      <Modal
        title={lostReportRecord ? `Báo mất ${lostReportRecord.asset?.asset_code || ''}` : 'Báo mất thiết bị'}
        open={!!lostReportRecord}
        onOk={handleReportLost}
        onCancel={() => setLostReportRecord(null)}
        confirmLoading={reportingLost}
        okText="Gửi báo mất"
        cancelText="Hủy"
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <Text type="secondary">
            Phiếu báo mất sẽ được gửi cho admin tiếp nhận. Các giấy tờ hoặc bồi thường nếu có sẽ xử lý trực tiếp ngoài hệ thống.
          </Text>
          <Form form={lostForm} layout="vertical">
            <Form.Item
              name="description"
              label="Mô tả tình huống mất"
              rules={[
                { required: true, message: 'Vui lòng nhập mô tả tình huống mất' },
                { min: 10, message: 'Mô tả cần tối thiểu 10 ký tự' },
              ]}
            >
              <Input.TextArea rows={4} placeholder="Ví dụ: thời điểm phát hiện mất, vị trí cuối cùng nhìn thấy, các bước đã kiểm tra..." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
};

export default BorrowHistoryPage;
