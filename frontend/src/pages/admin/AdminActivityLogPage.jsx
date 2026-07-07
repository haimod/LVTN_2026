import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Input, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';
import { formatVietnamDateTime } from '../../utils/dateTime';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const emptyFilters = {
  keyword: '',
  eventType: null,
  status: null,
  dateRange: null,
};

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

const formatDateTime = formatVietnamDateTime;
const getStatusText = (status) => statusMap[status]?.text || status || '-';

const AdminActivityLogPage = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        limit: 200,
      };

      if (appliedFilters.keyword?.trim()) {
        params.q = appliedFilters.keyword.trim();
      }

      if (appliedFilters.eventType) {
        params.event_type = appliedFilters.eventType;
      }

      if (appliedFilters.status) {
        params.status = appliedFilters.status;
      }

      if (appliedFilters.dateRange?.length === 2) {
        params.date_from = appliedFilters.dateRange[0].format('YYYY-MM-DD');
        params.date_to = appliedFilters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axiosInstance.get('/asset-histories', { params });
      const data = response.data.data ? response.data.data : response.data;
      setActivities(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải nhật ký hoạt động' });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    const timer = window.setTimeout(loadActivities, 0);
    return () => window.clearTimeout(timer);
  }, [loadActivities]);

  const eventOptions = Object.entries(eventMap).map(([value, label]) => ({
    value,
    label,
  }));

  const statusOptions = Object.entries(statusMap).map(([value, config]) => ({
    value,
    label: config.text,
  }));

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const columns = [
    {
      title: 'Hoạt động',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 180,
      render: (eventType) => <Tag color="blue">{eventMap[eventType] || eventType || 'Sự kiện'}</Tag>,
    },
    {
      title: 'Tài sản',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.asset_code || '-'}</Text>
          <Text type="secondary">{record.asset_name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Người liên quan',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 180,
      render: (value) => value || '-',
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 230,
      render: (_, record) => (
        <Space wrap>
          <Tag color="default">{getStatusText(record.old_status)}</Tag>
          <span>→</span>
          <Tag color={statusMap[record.new_status]?.color || 'default'}>{getStatusText(record.new_status)}</Tag>
        </Space>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: formatDateTime,
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <div>
          <Title level={3} style={{ margin: 0 }}>Nhật ký hoạt động</Title>
          <Text type="secondary">Theo dõi các thay đổi mới nhất trong vòng đời tài sản. Thời gian hiển thị theo UTC+7.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadActivities} loading={loading}>Làm mới</Button>
      </Space>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={8} xl={6}>
            <Input
              allowClear
              placeholder="Tìm mã, tên tài sản, người, ghi chú"
              value={filters.keyword}
              onChange={(event) => updateFilter('keyword', event.target.value)}
              onPressEnter={applyFilters}
            />
          </Col>
          <Col xs={24} sm={12} md={6} xl={4}>
            <Select
              allowClear
              placeholder="Loại hoạt động"
              value={filters.eventType}
              onChange={(value) => updateFilter('eventType', value)}
              options={eventOptions}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} xl={4}>
            <Select
              allowClear
              placeholder="Trạng thái"
              value={filters.status}
              onChange={(value) => updateFilter('status', value)}
              options={statusOptions}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={10} xl={6}>
            <RangePicker
              value={filters.dateRange}
              onChange={(value) => updateFilter('dateRange', value)}
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
            />
          </Col>
          <Col>
            <Space wrap>
              <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>Lọc</Button>
              <Button onClick={resetFilters}>Xóa lọc</Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={activities}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="Chưa có hoạt động gần đây" /> }}
        />
      </Card>
    </Space>
  );
};

export default AdminActivityLogPage;
