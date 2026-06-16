import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, List, Row, Skeleton, Space, Tag, Typography } from 'antd';
import {
  AppstoreOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const assetStatusMap = {
  new: { color: 'green', text: 'Kho tổng' },
  in_use: { color: 'blue', text: 'Đang sử dụng' },
  waiting: { color: 'gold', text: 'Chờ bàn giao' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Mất vĩnh viễn' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
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

const ManagerDashboardHome = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axiosInstance.get('/dashboard/manager');
      const data = response.data.data ? response.data.data : response.data;
      setDashboard(data);
    } catch {
      setError('Không thể tải tổng quan trưởng phòng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const isDepartmentApprover = dashboard?.is_department_approver === true;
  const approvalSummary = dashboard?.approval_summary || {};
  const assetStatuses = useMemo(() => dashboard?.department_asset_statuses || [], [dashboard]);
  const pendingRequests = dashboard?.pending_requests || [];
  const ownAssignmentSummary = useMemo(() => dashboard?.own_assignment_summary || {}, [dashboard]);
  const ownCurrentAssets = dashboard?.own_current_assets || [];

  const departmentAssetTotal = useMemo(
    () => assetStatuses.reduce((total, item) => total + (item.total || 0), 0),
    [assetStatuses],
  );

  const ownQrWork = useMemo(
    () => (ownAssignmentSummary.waiting || 0) + (ownAssignmentSummary.return_waiting || 0),
    [ownAssignmentSummary],
  );

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Tổng quan trưởng phòng</Title>
          <Text type="secondary">Theo dõi phòng ban, yêu cầu mượn và tài sản đang giao cho bạn.</Text>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>Làm mới</Button>
          {isDepartmentApprover ? (
            <Button type="primary" icon={<FileSearchOutlined />} onClick={() => navigate('/manager/assignment-approvals')}>
              Duyệt yêu cầu
            </Button>
          ) : (
            <Button type="primary" icon={<SendOutlined />} onClick={() => navigate('/manager/assignment-requests')}>
              Tạo yêu cầu
            </Button>
          )}
        </Space>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      {!loading && dashboard && !isDepartmentApprover ? (
        <Alert
          type="info"
          showIcon
          message="Tài khoản quản lý phụ không phải trưởng phòng duyệt chính."
          description="Bạn vẫn xem được nhân viên, tài sản phòng ban, lịch sử mượn và các luồng cá nhân."
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Nhân viên phòng ban"
            value={dashboard?.department_employee_count || 0}
            icon={<TeamOutlined style={{ color: '#1677ff', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Chờ duyệt"
            value={approvalSummary.pending || 0}
            icon={<ClockCircleOutlined style={{ color: '#d48806', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Tài sản phòng ban"
            value={departmentAssetTotal}
            icon={<AppstoreOutlined style={{ color: '#389e0d', fontSize: 24 }} />}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            label="Đang mượn trong phòng"
            value={dashboard?.department_active_assignments || 0}
            icon={<CheckSquareOutlined style={{ color: '#0958d9', fontSize: 24 }} />}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title={isDepartmentApprover ? 'Yêu cầu đang chờ duyệt' : 'Tài sản phòng ban'}
            extra={
              isDepartmentApprover
                ? <Button type="link" onClick={() => navigate('/manager/assignment-approvals')}>Xem tất cả</Button>
                : <Button type="link" onClick={() => navigate('/assets/list')}>Xem tài sản</Button>
            }
            bordered={false}
            style={{ borderRadius: 8 }}
          >
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              {isDepartmentApprover ? (
                pendingRequests.length ? (
                  <List
                    dataSource={pendingRequests}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button key="review" size="small" type="primary" onClick={() => navigate('/manager/assignment-approvals')}>
                            Duyệt
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <span>YC-{String(item.id).padStart(5, '0')}</span>
                              <Tag color="gold">Chờ duyệt</Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text>{item.requester_name || '-'} · {item.category_name || '-'}</Text>
                              <Text type="secondary">Gửi lúc {formatDateTime(item.created_at)}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="Không có yêu cầu đang chờ duyệt" />
                )
              ) : (
                assetStatuses.length ? (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {assetStatuses.map((item) => {
                      const current = getAssetStatus(item.status);

                      return (
                        <Space key={item.status} style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Tag color={current.color}>{current.text}</Tag>
                          <Text strong>{item.total}</Text>
                        </Space>
                      );
                    })}
                  </Space>
                ) : (
                  <Empty description="Chưa có dữ liệu tài sản phòng ban" />
                )
              )}
            </Skeleton>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Tài sản của tôi" bordered={false} style={{ borderRadius: 8 }}>
            <Skeleton loading={loading} active paragraph={{ rows: 5 }}>
              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <Card size="small" bordered style={{ borderRadius: 8 }}>
                    <Text type="secondary">Đang giữ</Text>
                    <Title level={4} style={{ margin: '4px 0 0' }}>{ownAssignmentSummary.active || 0}</Title>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" bordered style={{ borderRadius: 8 }}>
                    <Text type="secondary">Cần xác nhận/trả</Text>
                    <Title level={4} style={{ margin: '4px 0 0' }}>{ownQrWork}</Title>
                  </Card>
                </Col>
              </Row>

              {ownCurrentAssets.length ? (
                <List
                  dataSource={ownCurrentAssets}
                  renderItem={(item) => {
                    const assetStatus = getAssetStatus(item.asset_status);

                    return (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space wrap>
                              <span>{item.asset_code || '-'}</span>
                              <Tag color={assetStatus.color}>{assetStatus.text}</Tag>
                            </Space>
                          }
                          description={<Text type="secondary">{item.asset_name || '-'} · {formatDateTime(item.assigned_at)}</Text>}
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
      </Row>

      <Card title="Lối tắt nhanh" bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]}>
          {isDepartmentApprover ? (
            <Col xs={24} sm={12} lg={6}>
              <Button block icon={<FileSearchOutlined />} onClick={() => navigate('/manager/assignment-approvals')}>
                Duyệt yêu cầu
              </Button>
            </Col>
          ) : null}
          <Col xs={24} sm={12} lg={6}>
            <Button block icon={<SendOutlined />} onClick={() => navigate('/manager/assignment-requests')}>
              Yêu cầu của tôi
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button block icon={<QrcodeOutlined />} onClick={() => navigate('/employee/handover')}>
              Xác nhận bàn giao
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button block icon={<TeamOutlined />} onClick={() => navigate('/manager/employees')}>
              Nhân viên phòng ban
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button block icon={<HistoryOutlined />} onClick={() => navigate('/manager/borrow-history')}>
              Lịch sử mượn
            </Button>
          </Col>
        </Row>
      </Card>
    </Space>
  );
};

export default ManagerDashboardHome;
