import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, HistoryOutlined, PictureOutlined, QrcodeOutlined, RollbackOutlined, ToolOutlined } from '@ant-design/icons';
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
      render: (status) => {
        const current = statusMap[status] || { color: 'default', text: status || '-' };
        return <Tag color={current.color}>{current.text}</Tag>;
      },
    },
    {
      title: 'Ngày cấp phát',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: formatDateTime,
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
      width: 220,
      render: (_, record) => {
        if (record.status === 'waiting') {
          return (
            <Button
              size="small"
              type="primary"
              icon={<QrcodeOutlined />}
              disabled={!record.asset?.uuid}
              onClick={() => navigate(`/employee/handover?code=${encodeURIComponent(record.asset.uuid)}`)}
            >
              Xác nhận
            </Button>
          );
        }

        if (record.status === 'active') {
          if (record.return_requested_at) {
            return <Tag color="blue">Chờ admin nhận</Tag>;
          }

          if (record.asset?.status === 'under_investigation') {
            return <Tag color="volcano">Đang điều tra</Tag>;
          }

          if (record.asset?.status === 'permanently_lost') {
            return <Tag color="black">Đã báo mất</Tag>;
          }

          return (
            <Space size="small" wrap>
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

        return '-';
      },
    },
  ];

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
          scroll={{ x: 1180 }}
          locale={{ emptyText: <Empty description="Chưa có lịch sử mượn thiết bị" /> }}
        />
      </Card>

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
