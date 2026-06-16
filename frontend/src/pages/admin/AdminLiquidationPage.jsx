import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Image, Input, Row, Space, Table, Tag, Typography, notification } from 'antd';
import { PictureOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;
const apiOrigin = axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '');

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

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toLocaleString('vi-VN');
};

const AdminLiquidationPage = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
  });

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/liquidations', {
        params: {
          search: filters.search || undefined,
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải danh sách phiếu thanh lý' });
    } finally {
      setLoading(false);
    }
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(loadRecords, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const stats = useMemo(() => records.reduce((current, item) => {
    current.total += 1;
    current.totalValue += Number(item.asset?.purchase_price || 0);
    return current;
  }, { total: 0, totalValue: 0 }), [records]);

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
      title: 'Giá mua',
      key: 'purchase_price',
      render: (_, record) => formatMoney(record.asset?.purchase_price),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      render: () => <Tag color="default">Đã thanh lý</Tag>,
    },
    {
      title: 'Lý do thanh lý',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Người xử lý',
      key: 'handled_by',
      render: (_, record) => record.handled_by?.name || '-',
    },
    {
      title: 'Ngày thanh lý',
      dataIndex: 'disposed_at',
      key: 'disposed_at',
      render: formatDateTime,
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Phiếu thanh lý</Title>
        <Text type="secondary">Danh sách tài sản đã được admin thanh lý từ kho tổng.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng phiếu thanh lý</Text>
              <Space align="center">
                <StopOutlined style={{ color: '#722ed1', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.total}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Nguyên giá đã thanh lý</Text>
              <Title level={2} style={{ margin: 0 }}>{formatMoney(stats.totalValue)}</Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={8}>
            <Input.Search
              placeholder="Tìm mã, tên hoặc danh mục thiết bị"
              allowClear
              enterButton
              onSearch={(value) => setFilters({ search: value.trim() })}
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
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="Chưa có phiếu thanh lý" /> }}
        />
      </Card>
    </Space>
  );
};

export default AdminLiquidationPage;
