import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, notification, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const statusMap = {
  pending: { color: 'gold', text: 'Chờ trưởng phòng duyệt' },
  mgr_approved: { color: 'blue', text: 'Đã duyệt, chờ admin' },
  approved: { color: 'green', text: 'Đã cấp phát' },
  rejected: { color: 'red', text: 'Đã từ chối' },
  cancelled: { color: 'default', text: 'Đã hủy' },
  out_of_stock: { color: 'orange', text: 'Chờ nhập kho' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const ManagerApprovalPage = () => {
  const user = getCurrentUser();
  const hasApproverFlag = typeof user?.is_department_approver !== 'undefined';
  const isDepartmentApprover = user?.is_department_approver === true || user?.is_department_approver === 1;
  const shouldBlockApprovalPage = hasApproverFlag && !isDepartmentApprover;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(!shouldBlockApprovalPage);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reloadKey, setReloadKey] = useState(0);
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (shouldBlockApprovalPage) {
      return undefined;
    }

    let ignore = false;

    const fetchRequests = async () => {
      try {
        const response = await axiosInstance.get('/assignment-requests', {
          params: {
            scope: 'department',
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        });
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          setRequests(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ title: 'Không thể tải danh sách yêu cầu' });
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
  }, [statusFilter, reloadKey, shouldBlockApprovalPage]);

  const refreshRequests = () => {
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  const handleApprove = (record) => {
    Modal.confirm({
      title: 'Duyệt yêu cầu mượn thiết bị?',
      content: `Yêu cầu YC-${String(record.id).padStart(5, '0')} sẽ được chuyển sang bước admin cấp phát.`,
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          setLoading(true);
          await axiosInstance.patch(`/assignment-requests/${record.id}/manager-approve`, {
            manager_note: null,
          });
          notification.success({ title: 'Đã duyệt yêu cầu' });
          refreshRequests();
        } catch (error) {
          const message = error.response?.data?.message || 'Không thể duyệt yêu cầu.';
          notification.error({ title: 'Thao tác bị chặn', description: message });
          setLoading(false);
        }
      },
    });
  };

  const openRejectModal = (record) => {
    form.resetFields();
    setRejectingRequest(record);
  };

  const handleReject = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await axiosInstance.patch(`/assignment-requests/${rejectingRequest.id}/manager-reject`, values);
      notification.success({ title: 'Đã từ chối yêu cầu' });
      setRejectingRequest(null);
      refreshRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng nhập lý do từ chối hợp lệ.';
      notification.error({ title: 'Không thể từ chối yêu cầu', description: message });
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
      title: 'Nhân viên',
      key: 'requester',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.requester?.name || '-'}</span>
          <Text type="secondary">{record.requester?.email || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Phòng ban',
      key: 'department',
      render: (_, record) => record.requester?.department?.name || '-',
    },
    {
      title: 'Thiết bị cần mượn',
      key: 'category',
      render: (_, record) => record.category?.name || '-',
    },
    {
      title: 'Nhu cầu cụ thể',
      dataIndex: 'requested_specification',
      key: 'requested_specification',
      ellipsis: true,
      render: (value) => value || '-',
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
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      key: 'created_at',
      render: formatDateTime,
    },
    {
      title: 'Thao tác',
      key: 'action',
      fixed: 'right',
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => setViewingRequest(record)}>Chi tiết</Button>
          {record.status === 'pending' ? (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>Duyệt</Button>
              <Button danger icon={<CloseOutlined />} onClick={() => openRejectModal(record)}>Từ chối</Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Duyệt yêu cầu mượn thiết bị</Title>
        <Text type="secondary">Xử lý các yêu cầu của nhân viên trong phòng ban trước khi chuyển admin cấp phát.</Text>
      </div>

      {shouldBlockApprovalPage ? (
        <Alert
          type="warning"
          showIcon
          message="Bạn không phải trưởng phòng duyệt chính của phòng ban."
          description="Tài khoản manager/phó phòng vẫn được xem các chức năng quản lý khác, nhưng không có quyền duyệt hoặc từ chối yêu cầu mượn thiết bị của nhân viên."
        />
      ) : null}

      {!shouldBlockApprovalPage ? <Card bordered={false} style={{ borderRadius: 8 }}>
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
          scroll={{ x: 1430 }}
        />
      </Card> : null}

      <Modal
        title={viewingRequest ? `Chi tiết YC-${String(viewingRequest.id).padStart(5, '0')}` : 'Chi tiết yêu cầu'}
        open={!!viewingRequest}
        onCancel={() => setViewingRequest(null)}
        footer={[
          <Button key="close" onClick={() => setViewingRequest(null)}>Đóng</Button>,
          viewingRequest?.status === 'pending' ? (
            <Button
              key="approve"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => {
                const request = viewingRequest;
                setViewingRequest(null);
                handleApprove(request);
              }}
            >
              Duyệt
            </Button>
          ) : null,
          viewingRequest?.status === 'pending' ? (
            <Button
              key="reject"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                const request = viewingRequest;
                setViewingRequest(null);
                openRejectModal(request);
              }}
            >
              Từ chối
            </Button>
          ) : null,
        ]}
        width={720}
      >
        {viewingRequest ? (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Mã yêu cầu">YC-{String(viewingRequest.id).padStart(5, '0')}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {(() => {
                  const current = statusMap[viewingRequest.status] || { color: 'default', text: viewingRequest.status || '-' };
                  return <Tag color={current.color}>{current.text}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Nhân viên">{viewingRequest.requester?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Email">{viewingRequest.requester?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="Phòng ban">{viewingRequest.requester?.department?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Danh mục thiết bị">{viewingRequest.category?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Thiết bị/cấu hình mong muốn">{viewingRequest.requested_specification || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ngày dự kiến trả">{formatDate(viewingRequest.expected_return_date)}</Descriptions.Item>
              <Descriptions.Item label="Lý do mượn">{viewingRequest.reason || '-'}</Descriptions.Item>
              <Descriptions.Item label="Ngày gửi">{formatDateTime(viewingRequest.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Trưởng phòng xử lý">{viewingRequest.manager?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Thời điểm trưởng phòng xử lý">{formatDateTime(viewingRequest.manager_at)}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú trưởng phòng">{viewingRequest.manager_note || '-'}</Descriptions.Item>
              <Descriptions.Item label="Admin xử lý">{viewingRequest.admin?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Thời điểm admin xử lý">{formatDateTime(viewingRequest.admin_at)}</Descriptions.Item>
              <Descriptions.Item label="Ghi chú admin">{viewingRequest.admin_note || '-'}</Descriptions.Item>
            </Descriptions>
          </Space>
        ) : null}
      </Modal>

      <Modal
        title={rejectingRequest ? `Từ chối YC-${String(rejectingRequest.id).padStart(5, '0')}` : 'Từ chối yêu cầu'}
        open={!!rejectingRequest}
        onOk={handleReject}
        onCancel={() => setRejectingRequest(null)}
        confirmLoading={loading}
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="manager_note"
            label="Lý do từ chối"
            rules={[
              { required: true, message: 'Vui lòng nhập lý do từ chối' },
              { min: 5, message: 'Lý do từ chối cần tối thiểu 5 ký tự' },
            ]}
          >
            <Input.TextArea rows={4} placeholder="Nhập lý do để nhân viên biết vì sao yêu cầu bị từ chối" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default ManagerApprovalPage;
