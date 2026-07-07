import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Image, List, Row, Skeleton, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlusOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const requestStatusMap = {
  pending: { color: 'gold', text: 'Chờ trưởng phòng duyệt' },
  mgr_approved: { color: 'blue', text: 'Chờ admin cấp phát' },
  approved: { color: 'green', text: 'Đã cấp phát' },
  rejected: { color: 'red', text: 'Đã từ chối' },
  cancelled: { color: 'default', text: 'Đã hủy' },
  out_of_stock: { color: 'orange', text: 'Chờ nhập kho' },
};

const assignmentStatusMap = {
  waiting: { color: 'gold', text: 'Chờ xác nhận QR' },
  active: { color: 'green', text: 'Đang mượn' },
  returned: { color: 'default', text: 'Đã trả' },
};

const assetStatusMap = {
  new: { color: 'green', text: 'Kho tổng' },
  in_use: { color: 'blue', text: 'Đang sử dụng' },
  waiting: { color: 'gold', text: 'Chờ bàn giao' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Đã báo mất' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');

const getApiOrigin = () => {
  try {
    return new URL(axiosInstance.defaults.baseURL).origin;
  } catch {
    return '';
  }
};

const apiOrigin = getApiOrigin();

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const getRequestStatus = (status) => requestStatusMap[status] || { color: 'default', text: status || '-' };
const getAssignmentStatus = (status) => assignmentStatusMap[status] || { color: 'default', text: status || '-' };
const getAssetStatus = (status) => assetStatusMap[status] || { color: 'default', text: status || '-' };

const StatCard = ({ icon, label, value, loading }) => (
  <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
    <Space direction="vertical" size={4}>
      <Text type="secondary">{label}</Text>
      <Space align="center">
        {icon}
        <Title level={2} style={{ margin: 0 }}>{value}</Title>
      </Space>
    </Space>
  </Card>
);

const AssetThumb = ({ path, name }) => {
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
      preview={false}
      src={imageUrl}
      alt={name}
      style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #f0f0f0' }}
    />
  );
};

const EmployeeDashboardHome = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get('/dashboard/user');
      const data = response.data.data ? response.data.data : response.data;
      setDashboard(data);
    } catch {
      setError('Không thể tải tổng quan nhân viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const requestSummary = useMemo(() => dashboard?.request_summary || {}, [dashboard]);
  const assignmentSummary = useMemo(() => dashboard?.assignment_summary || {}, [dashboard]);
  const currentAssets = dashboard?.current_assets || [];
  const recentRequests = dashboard?.recent_requests || [];

  const waitingWork = useMemo(
    () => (requestSummary.pending || 0) + (requestSummary.mgr_approved || 0) + (requestSummary.out_of_stock || 0),
    [requestSummary],
  );

  const qrWork = useMemo(
    () => (assignmentSummary.waiting || 0) + (assignmentSummary.return_waiting || 0),
    [assignmentSummary],
  );

  const renderAssetAction = (item) => {
    if (item.status === 'waiting' && item.asset_uuid) {
      return (
        <Button
          type="primary"
          size="small"
          icon={<QrcodeOutlined />}
          onClick={() => navigate(`/employee/handover?code=${encodeURIComponent(item.asset_uuid)}`)}
        >
          Xác nhận
        </Button>
      );
    }

    if (item.status === 'active') {
      if (item.return_requested_at) {
        return <Tag color="blue">Chờ admin nhận</Tag>;
      }

      if (['under_investigation', 'permanently_lost', 'repairing'].includes(item.asset_status)) {
        const assetStatus = getAssetStatus(item.asset_status);
        return <Tag color={assetStatus.color}>{assetStatus.text}</Tag>;
      }

      return (
        <Button
          size="small"
          icon={<QrcodeOutlined />}
          onClick={() => navigate(item.asset_uuid ? `/employee/handover?code=${encodeURIComponent(item.asset_uuid)}` : '/employee/handover')}
        >
          Quét QR
        </Button>
      );
    }

    return null;
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Tổng quan nhân viên</Title>
          <Text type="secondary">Tình trạng yêu cầu mượn và tài sản đang giao cho bạn.</Text>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>Làm mới</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/employee/assignment-requests')}>
            Tạo yêu cầu
          </Button>
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Tổng yêu cầu"
            value={requestSummary.total || 0}
            icon={<FileTextOutlined style={{ color: '#1677ff', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Chờ xử lý"
            value={waitingWork}
            icon={<ClockCircleOutlined style={{ color: '#d48806', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Đang giữ"
            value={assignmentSummary.active || 0}
            icon={<CheckCircleOutlined style={{ color: '#389e0d', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Cần xác nhận/trả"
            value={qrWork}
            icon={<RollbackOutlined style={{ color: '#0958d9', fontSize: 24 }} />}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title="Tài sản đang giao"
            extra={<Button type="link" onClick={() => navigate('/employee/borrow-history')}>Lịch sử mượn</Button>}
            bordered={false}
            style={{ borderRadius: 8 }}
          >
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              {currentAssets.length ? (
                <List
                  dataSource={currentAssets}
                  renderItem={(item) => {
                    const assignmentStatus = getAssignmentStatus(item.status);
                    const assetStatus = getAssetStatus(item.asset_status);

                    return (
                      <List.Item actions={[renderAssetAction(item)].filter(Boolean)}>
                        <List.Item.Meta
                          avatar={<AssetThumb path={item.image_path} name={item.asset_name} />}
                          title={
                            <Space wrap>
                              <span>{item.asset_code || '-'}</span>
                              <Tag color={assignmentStatus.color}>{assignmentStatus.text}</Tag>
                              <Tag color={assetStatus.color}>{assetStatus.text}</Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text>{item.asset_name || '-'}</Text>
                              <Text type="secondary">{item.category_name || '-'} · Cấp phát {formatDateTime(item.assigned_at)}</Text>
                              <Text type="secondary">Dự kiến trả {formatDate(item.expected_return_date)}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="Chưa có tài sản đang giao" />
              )}
            </Skeleton>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title="Yêu cầu gần đây"
            extra={<Button type="link" onClick={() => navigate('/employee/assignment-requests')}>Xem tất cả</Button>}
            bordered={false}
            style={{ borderRadius: 8 }}
          >
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              {recentRequests.length ? (
                <List
                  dataSource={recentRequests}
                  renderItem={(item) => {
                    const requestStatus = getRequestStatus(item.status);

                    return (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <span>YC-{String(item.id).padStart(5, '0')}</span>
                              <Tag color={requestStatus.color}>{requestStatus.text}</Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text>{item.category_name || 'Thiết bị chưa xác định'}</Text>
                              <Text type="secondary">{item.requested_specification || '-'}</Text>
                              <Text type="secondary">Gửi lúc {formatDateTime(item.created_at)}</Text>
                              <Text type="secondary">Dự kiến trả {formatDate(item.expected_return_date)}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty description="Chưa có yêu cầu mượn thiết bị" />
              )}
            </Skeleton>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default EmployeeDashboardHome;
