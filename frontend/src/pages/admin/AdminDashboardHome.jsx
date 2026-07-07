import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, List, Row, Skeleton, Space, Tag, Typography, notification } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { formatVietnamDateTime } from '../../utils/dateTime';

const { Title, Text } = Typography;

const statusMap = {
  new: { color: 'green', text: 'Kho tổng' },
  in_use: { color: 'blue', text: 'Đang sử dụng' },
  waiting: { color: 'gold', text: 'Chờ bàn giao' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Mất vĩnh viễn' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const eventMap = {
  assigned: 'Cấp phát',
  confirmed_handover: 'Xác nhận bàn giao',
  reported_damage: 'Báo hỏng',
  repairing: 'Tiếp nhận bảo trì',
  repaired: 'Hoàn tất bảo trì',
  reported_lost: 'Báo mất',
  lost_recovered: 'Tìm lại thiết bị',
  confirmed_lost: 'Xác nhận mất',
  return_requested: 'Yêu cầu trả',
  returned_to_warehouse: 'Nhận lại kho',
  disposed: 'Thanh lý',
};

const levelConfig = {
  processing: { color: '#1677ff', icon: <FileDoneOutlined /> },
  warning: { color: '#d48806', icon: <ClockCircleOutlined /> },
  danger: { color: '#cf1322', icon: <WarningOutlined /> },
  success: { color: '#389e0d', icon: <CheckCircleOutlined /> },
};

const formatDateTime = formatVietnamDateTime;
const getStatusText = (status) => statusMap[status]?.text || status || '-';

const AdminDashboardHome = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/dashboard/admin');
      const data = response.data.data ? response.data.data : response.data;
      setDashboard(data);
    } catch {
      notification.error({ message: 'Không thể tải tổng quan quản trị' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const workItems = useMemo(() => dashboard?.work_items || [], [dashboard]);
  const assetStatuses = useMemo(() => dashboard?.asset_statuses || [], [dashboard]);
  const recentActivities = dashboard?.recent_activities || [];
  const recentActivityPreview = recentActivities.slice(0, 2);
  const quickLinks = dashboard?.quick_links || [];

  const assetTotals = useMemo(() => assetStatuses.reduce((current, item) => {
    current.total += item.total || 0;
    current[item.status] = item.total || 0;
    return current;
  }, { total: 0 }), [assetStatuses]);

  const urgentTotal = useMemo(() => workItems.reduce((total, item) => total + (item.count || 0), 0), [workItems]);

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <div>
          <Title level={3} style={{ margin: 0 }}>Tổng quan quản trị</Title>
          <Text type="secondary">Theo dõi việc cần xử lý và tình trạng tài sản hiện tại.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>Làm mới</Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Việc cần xử lý</Text>
              <Space align="center">
                <WarningOutlined style={{ color: urgentTotal ? '#cf1322' : '#389e0d', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{urgentTotal}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng tài sản</Text>
              <Space align="center">
                <AppstoreOutlined style={{ color: '#1677ff', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{assetTotals.total || 0}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Sẵn sàng trong kho</Text>
              <Space align="center">
                <CheckCircleOutlined style={{ color: '#389e0d', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{assetTotals.new || 0}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đang sử dụng</Text>
              <Space align="center">
                <ToolOutlined style={{ color: '#0958d9', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{assetTotals.in_use || 0}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Việc cần xử lý" bordered={false} style={{ borderRadius: 8 }}>
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              <Row gutter={[12, 12]}>
                {workItems.map((item) => {
                  const config = levelConfig[item.level] || levelConfig.processing;

                  return (
                    <Col xs={24} md={12} key={item.key}>
                      <Card size="small" bordered style={{ borderRadius: 8 }}>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
                          <Space align="center">
                            <span style={{ color: config.color, fontSize: 22 }}>{config.icon}</span>
                            <Space direction="vertical" size={0}>
                              <Text strong>{item.title}</Text>
                              <Text type="secondary">{item.count || 0} mục</Text>
                            </Space>
                          </Space>
                          <Button type="link" onClick={() => navigate(item.path)} icon={<RightOutlined />}>
                            Xử lý
                          </Button>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Skeleton>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Tình trạng tài sản" bordered={false} style={{ borderRadius: 8 }}>
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              {assetStatuses.length ? (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {assetStatuses.map((item) => {
                    const current = statusMap[item.status] || { color: 'default', text: item.status || '-' };
                    return (
                      <Space key={item.status} style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color={current.color}>{current.text}</Tag>
                        <Text strong>{item.total}</Text>
                      </Space>
                    );
                  })}
                </Space>
              ) : (
                <Empty description="Chưa có dữ liệu tài sản" />
              )}
            </Skeleton>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title="Hoạt động mới"
            extra={<Button type="link" icon={<HistoryOutlined />} onClick={() => navigate('/admin/activity-log')}>Xem nhật ký</Button>}
            bordered={false}
            style={{ borderRadius: 8 }}
          >
            <Skeleton loading={loading} active paragraph={{ rows: 2 }}>
              {recentActivityPreview.length ? (
                <List
                  dataSource={recentActivityPreview}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <Text strong>{eventMap[item.event_type] || item.event_type || 'Sự kiện'}</Text>
                            <Text type="secondary">{item.asset_code || '-'}</Text>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={2}>
                            <Text>{item.asset_name || '-'} - {item.user_name || '-'}</Text>
                            <Space wrap>
                              <Text type="secondary">{formatDateTime(item.created_at)}</Text>
                              <Tag color="default">{getStatusText(item.old_status)}</Tag>
                              <span>→</span>
                              <Tag color={statusMap[item.new_status]?.color || 'default'}>{getStatusText(item.new_status)}</Tag>
                            </Space>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="Chưa có hoạt động gần đây" />
              )}
            </Skeleton>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Lối tắt nhanh" bordered={false} style={{ borderRadius: 8 }}>
            <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
              <Row gutter={[12, 12]}>
                {quickLinks.map((item) => (
                  <Col xs={24} sm={12} key={item.key}>
                    <Button block onClick={() => navigate(item.path)}>
                      {item.title}
                    </Button>
                  </Col>
                ))}
              </Row>
            </Skeleton>
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default AdminDashboardHome;
