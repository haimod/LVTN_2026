import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, notification, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, ClockCircleOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const statusMap = {
  pending: { color: 'gold', text: 'Chờ trưởng phòng duyệt' },
  mgr_approved: { color: 'blue', text: 'Chờ admin cấp phát' },
  approved: { color: 'green', text: 'Đã cấp phát' },
  rejected: { color: 'red', text: 'Đã từ chối' },
  cancelled: { color: 'default', text: 'Đã hủy' },
  out_of_stock: { color: 'orange', text: 'Chờ nhập kho' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');

const isManagerRequest = (record) => (
  String(record.manager_id || '') === String(record.requester_id || '')
  || record.requester?.roles?.some((role) => role.name === 'manager')
);

const AdminBorrowRequestPage = () => {
  const [requests, setRequests] = useState([]);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('mgr_approved');
  const [reloadKey, setReloadKey] = useState(0);
  const [fulfillingRequest, setFulfillingRequest] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [outOfStockRequest, setOutOfStockRequest] = useState(null);
  const [fulfillForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [outOfStockForm] = Form.useForm();

  useEffect(() => {
    let ignore = false;

    const fetchRequests = async () => {
      try {
        const response = await axiosInstance.get('/assignment-requests', {
          params: statusFilter ? { status: statusFilter } : {},
        });
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          setRequests(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Không thể tải danh sách yêu cầu mượn' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchRequests();

    return () => {
      ignore = true;
    };
  }, [statusFilter, reloadKey]);

  const refreshRequests = () => {
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  const openFulfillModal = async (record) => {
    setFulfillingRequest(record);
    fulfillForm.resetFields();
    setAvailableAssets([]);
    setAssetLoading(true);

    try {
      const response = await axiosInstance.get('/assets', {
        params: {
          category_id: record.category_id,
          status: 'new',
          department_id: 'warehouse',
        },
      });
      const data = response.data.data ? response.data.data : response.data;
      setAvailableAssets(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Không thể tải danh sách thiết bị còn trống' });
    } finally {
      setAssetLoading(false);
    }
  };

  const handleFulfill = async () => {
    try {
      const values = await fulfillForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/assignment-requests/${fulfillingRequest.id}/admin-fulfill`, values);
      notification.success({ message: 'Đã cấp phát thiết bị' });
      setFulfillingRequest(null);
      refreshRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể cấp phát thiết bị.';
      notification.error({ message: 'Thao tác bị chặn', description: message });
      setLoading(false);
    }
  };

  const openRejectModal = (record) => {
    rejectForm.resetFields();
    setRejectingRequest(record);
  };

  const openOutOfStockModal = (record) => {
    outOfStockForm.resetFields();
    setOutOfStockRequest(record);
  };

  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/assignment-requests/${rejectingRequest.id}/admin-reject`, values);
      notification.success({ message: 'Đã từ chối cấp phát' });
      setRejectingRequest(null);
      refreshRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng nhập lý do từ chối hợp lệ.';
      notification.error({ message: 'Không thể từ chối yêu cầu', description: message });
      setLoading(false);
    }
  };

  const handleOutOfStock = async () => {
    try {
      const values = await outOfStockForm.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/assignment-requests/${outOfStockRequest.id}/admin-out-of-stock`, values);
      notification.success({ message: 'Đã chuyển yêu cầu sang chờ nhập kho' });
      setOutOfStockRequest(null);
      refreshRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng nhập ghi chú hợp lệ.';
      notification.error({ message: 'Không thể chuyển trạng thái', description: message });
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mã yêu cầu',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id) => <strong>YC-{String(id).padStart(5, '0')}</strong>,
    },
    {
      title: 'Loại đơn',
      key: 'request_type',
      width: 160,
      render: (_, record) => (
        isManagerRequest(record)
          ? <Tag color="purple">Cấp quản lý</Tag>
          : <Tag color="cyan">Nhân viên</Tag>
      ),
    },
    {
      title: 'Người yêu cầu',
      key: 'requester',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.requester?.name || '-'}</span>
          <Text type="secondary">{record.requester?.department?.name || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Danh mục thiết bị',
      key: 'category',
      render: (_, record) => record.category?.name || '-',
    },
    {
      title: 'Lý do',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
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
      title: 'Trưởng phòng duyệt',
      key: 'manager',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.manager?.name || '-'}</span>
          <Text type="secondary">{formatDateTime(record.manager_at)}</Text>
        </Space>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        ['mgr_approved', 'out_of_stock'].includes(record.status) ? (
          <Space>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openFulfillModal(record)}>Cấp phát</Button>
            {record.status === 'mgr_approved' ? (
              <>
                <Button icon={<ClockCircleOutlined />} onClick={() => openOutOfStockModal(record)}>Chờ kho</Button>
                <Button danger icon={<CloseOutlined />} onClick={() => openRejectModal(record)}>Từ chối</Button>
              </>
            ) : null}
          </Space>
        ) : '-'
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Duyệt mượn & cấp phát</Title>
        <Text type="secondary">Xử lý yêu cầu đã qua trưởng phòng hoặc yêu cầu cấp quản lý.</Text>
      </div>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={7}>
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              value={statusFilter}
              style={{ width: '100%' }}
              onChange={(value) => {
                setLoading(true);
                setStatusFilter(value);
              }}
              options={Object.entries(statusMap).map(([value, config]) => ({
                value,
                label: config.text,
              }))}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={refreshRequests}>Làm mới</Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={fulfillingRequest ? `Cấp phát YC-${String(fulfillingRequest.id).padStart(5, '0')}` : 'Cấp phát thiết bị'}
        open={!!fulfillingRequest}
        onOk={handleFulfill}
        onCancel={() => setFulfillingRequest(null)}
        confirmLoading={loading}
        okText="Xác nhận cấp phát"
        cancelText="Hủy"
        width={650}
      >
        <Form form={fulfillForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Danh mục yêu cầu">
            <Input value={fulfillingRequest?.category?.name || '-'} disabled />
          </Form.Item>

          <Form.Item
            name="asset_id"
            label="Thiết bị còn trống"
            rules={[{ required: true, message: 'Vui lòng chọn thiết bị để cấp phát' }]}
          >
            <Select
              placeholder="Chọn thiết bị cụ thể"
              loading={assetLoading}
              showSearch
              optionFilterProp="label"
              options={availableAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.asset_code} - ${asset.name}`,
              }))}
              notFoundContent={assetLoading ? 'Đang tải...' : 'Không có thiết bị còn trống'}
            />
          </Form.Item>

          <Form.Item name="admin_note" label="Ghi chú cấp phát">
            <Input.TextArea rows={3} placeholder="Ghi chú cho phiếu bàn giao nếu cần" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={outOfStockRequest ? `Chờ nhập kho YC-${String(outOfStockRequest.id).padStart(5, '0')}` : 'Chờ nhập kho'}
        open={!!outOfStockRequest}
        onOk={handleOutOfStock}
        onCancel={() => setOutOfStockRequest(null)}
        confirmLoading={loading}
        okText="Chuyển sang chờ nhập kho"
        cancelText="Hủy"
      >
        <Form form={outOfStockForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="admin_note"
            label="Ghi chú cho nhân viên"
            rules={[
              { required: true, message: 'Vui lòng nhập ghi chú' },
              { min: 5, message: 'Ghi chú cần tối thiểu 5 ký tự' },
            ]}
          >
            <Input.TextArea rows={4} placeholder="Ví dụ: Kho tổng tạm hết laptop, sẽ cấp phát khi nhập hàng mới." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={rejectingRequest ? `Từ chối YC-${String(rejectingRequest.id).padStart(5, '0')}` : 'Từ chối cấp phát'}
        open={!!rejectingRequest}
        onOk={handleReject}
        onCancel={() => setRejectingRequest(null)}
        confirmLoading={loading}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="admin_note"
            label="Lý do từ chối"
            rules={[
              { required: true, message: 'Vui lòng nhập lý do từ chối' },
              { min: 5, message: 'Lý do từ chối cần tối thiểu 5 ký tự' },
            ]}
          >
            <Input.TextArea rows={4} placeholder="Nhập lý do để người yêu cầu biết vì sao không được cấp phát" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default AdminBorrowRequestPage;
