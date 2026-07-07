import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Descriptions, Form, Input, Modal, notification, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { EyeOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const statusMap = {
  waiting: { color: 'gold', text: 'Chờ xác nhận' },
  active: { color: 'green', text: 'Đang mượn' },
  returned: { color: 'default', text: 'Đã trả' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');
const renderStatus = (status) => {
  const current = statusMap[status] || { color: 'default', text: status || '-' };
  return <Tag color={current.color}>{current.text}</Tag>;
};

const AdminEmergencyAllocationPage = () => {
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewingAllocation, setViewingAllocation] = useState(null);
  const [assetKeyword, setAssetKeyword] = useState('');
  const [assetCategoryId, setAssetCategoryId] = useState(null);

  useEffect(() => {
    let ignore = false;

    const fetchDependencies = async () => {
      setLoading(true);

      try {
        const [usersRes, assetsRes, categoriesRes, allocationsRes] = await Promise.all([
          axiosInstance.get('/users'),
          axiosInstance.get('/assets', { params: { status: 'new' } }),
          axiosInstance.get('/categories'),
          axiosInstance.get('/emergency-allocations'),
        ]);

        if (!ignore) {
          const userData = usersRes.data.data ? usersRes.data.data : usersRes.data;
          const assetData = assetsRes.data.data ? assetsRes.data.data : assetsRes.data;
          const categoryData = categoriesRes.data.data ? categoriesRes.data.data : categoriesRes.data;
          const allocationData = allocationsRes.data.data ? allocationsRes.data.data : allocationsRes.data;

          setUsers(Array.isArray(userData) ? userData.filter((user) => user.is_active === 1 || user.is_active === true) : []);
          setAssets(Array.isArray(assetData) ? assetData : []);
          setCategories(Array.isArray(categoryData) ? categoryData : []);
          setAllocations(Array.isArray(allocationData) ? allocationData : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ title: 'Không thể tải dữ liệu cấp phát khẩn cấp' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchDependencies();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const refreshData = () => setReloadKey((current) => current + 1);
  const filteredAssets = useMemo(() => {
    const keyword = assetKeyword.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesCategory = !assetCategoryId || String(asset.category_id) === String(assetCategoryId);
      const searchableText = [
        asset.asset_code,
        asset.name,
        asset.category?.name,
        asset.department?.name || 'Kho tổng',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesCategory && (!keyword || searchableText.includes(keyword));
    });
  }, [assets, assetCategoryId, assetKeyword]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await axiosInstance.post('/emergency-allocations', {
        ...values,
        expected_return_date: values.expected_return_date.format('YYYY-MM-DD'),
      });
      notification.success({ title: 'Đã tạo phiếu cấp phát khẩn cấp' });
      form.resetFields();
      refreshData();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin cấp phát.';
      notification.error({ title: 'Không thể cấp phát khẩn cấp', description: message });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id) => <strong>BG-{String(id).padStart(5, '0')}</strong>,
    },
    {
      title: 'Thiết bị',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.asset?.asset_code || '-'}</span>
          <Text type="secondary">{record.asset?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Người nhận',
      key: 'user',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.user?.name || '-'}</span>
          <Text type="secondary">{record.user?.department?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: renderStatus,
    },
    {
      title: 'Người cấp phát',
      key: 'assigned_by',
      render: (_, record) => record.assigned_by?.name || '-',
    },
    {
      title: 'Thời điểm cấp',
      dataIndex: 'assigned_at',
      key: 'assigned_at',
      render: formatDateTime,
    },
    {
      title: 'Dự kiến trả',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 130,
      render: formatDate,
    },
    {
      title: 'Lý do',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Button icon={<EyeOutlined />} onClick={() => setViewingAllocation(record)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Cấp phát khẩn cấp</Title>
        <Text type="secondary">Bỏ qua quy trình tạo đơn, nhưng vẫn tạo phiếu bàn giao chờ nhân viên xác nhận qua QR.</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="user_id"
                label="Nhân viên nhận"
                rules={[{ required: true, message: 'Vui lòng chọn nhân viên nhận thiết bị' }]}
              >
                <Select
                  placeholder="Chọn nhân viên"
                  showSearch
                  optionFilterProp="label"
                  options={users.map((user) => ({
                    value: user.id,
                    label: `${user.name} - ${user.department?.name || 'Chưa có phòng ban'}`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Lọc danh mục">
                <Select
                  placeholder="Tất cả danh mục"
                  allowClear
                  value={assetCategoryId}
                  showSearch
                  optionFilterProp="label"
                  onChange={(value) => {
                    setAssetCategoryId(value || null);
                    form.setFieldsValue({ asset_id: undefined });
                  }}
                  options={categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Tìm thiết bị">
                <Input.Search
                  allowClear
                  value={assetKeyword}
                  placeholder="Nhập mã, tên, danh mục hoặc phòng ban"
                  onChange={(event) => setAssetKeyword(event.target.value)}
                  onSearch={(value) => setAssetKeyword(value)}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="asset_id"
                label="Thiết bị đang rảnh"
                extra={`Đang hiển thị ${filteredAssets.length}/${assets.length} thiết bị rảnh`}
                rules={[{ required: true, message: 'Vui lòng chọn thiết bị cấp phát' }]}
              >
                <Select
                  placeholder="Chọn thiết bị từ kết quả lọc"
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) => (
                    option?.label?.toLowerCase().includes(input.toLowerCase())
                  )}
                  options={filteredAssets.map((asset) => ({
                    value: asset.id,
                    label: `${asset.asset_code} - ${asset.name} (${asset.category?.name || 'Không rõ danh mục'} · ${asset.department?.name || 'Kho tổng'})`,
                  }))}
                  notFoundContent="Không có thiết bị rảnh"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="reason"
                label="Lý do khẩn cấp"
                rules={[
                  { required: true, message: 'Vui lòng nhập lý do cấp phát khẩn cấp' },
                  { min: 10, message: 'Lý do cần tối thiểu 10 ký tự' },
                ]}
              >
                <Input.TextArea rows={1} placeholder="VD: Thiết bị hỏng đột xuất, cần máy thay thế ngay..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="expected_return_date"
                label="Ngày dự kiến trả"
                rules={[{ required: true, message: 'Vui lòng chọn ngày dự kiến trả' }]}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày trả dự kiến"
                  style={{ width: '100%' }}
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={saving} onClick={handleCreate}>
              Tạo phiếu khẩn cấp
            </Button>
            <Button icon={<ReloadOutlined />} onClick={refreshData}>Làm mới</Button>
          </Space>
        </Form>
      </Card>

      <Card title="Phiếu cấp phát khẩn cấp gần đây" bordered={false} style={{ borderRadius: 8 }}>
        <Table
          columns={columns}
          dataSource={allocations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1180 }}
        />
      </Card>

      <Modal
        title={viewingAllocation ? `Chi tiết BG-${String(viewingAllocation.id).padStart(5, '0')}` : 'Chi tiết phiếu cấp phát khẩn cấp'}
        open={!!viewingAllocation}
        onCancel={() => setViewingAllocation(null)}
        footer={<Button onClick={() => setViewingAllocation(null)}>Đóng</Button>}
        width={760}
      >
        {viewingAllocation ? (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Mã phiếu">
                <strong>BG-{String(viewingAllocation.id).padStart(5, '0')}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{renderStatus(viewingAllocation.status)}</Descriptions.Item>
              <Descriptions.Item label="Thiết bị">
                {viewingAllocation.asset?.asset_code || '-'} - {viewingAllocation.asset?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {viewingAllocation.asset?.category?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {viewingAllocation.user?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Email người nhận">
                {viewingAllocation.user?.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Phòng ban">
                {viewingAllocation.user?.department?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Người cấp phát">
                {viewingAllocation.assigned_by?.name || viewingAllocation.assignedBy?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm cấp">
                {formatDateTime(viewingAllocation.assigned_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm xác nhận">
                {formatDateTime(viewingAllocation.confirmed_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày dự kiến trả">
                {formatDate(viewingAllocation.expected_return_date)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày trả thực tế">
                {formatDateTime(viewingAllocation.returned_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú / lý do khẩn cấp">
                {viewingAllocation.note || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : null}
      </Modal>
    </Space>
  );
};

export default AdminEmergencyAllocationPage;
