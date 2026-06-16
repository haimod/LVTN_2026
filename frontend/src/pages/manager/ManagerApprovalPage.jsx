import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Modal, notification, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';
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
          notification.error({ message: 'Không thể tải danh sách yêu cầu' });
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
          notification.success({ message: 'Đã duyệt yêu cầu' });
          refreshRequests();
        } catch (error) {
          const message = error.response?.data?.message || 'Không thể duyệt yêu cầu.';
          notification.error({ message: 'Thao tác bị chặn', description: message });
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
      notification.success({ message: 'Đã từ chối yêu cầu' });
      setRejectingRequest(null);
      refreshRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Vui lòng nhập lý do từ chối hợp lệ.';
      notification.error({ message: 'Không thể từ chối yêu cầu', description: message });
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
      width: 170,
      render: (_, record) => (
        record.status === 'pending' ? (
          <Space>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(record)}>Duyệt</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openRejectModal(record)}>Từ chối</Button>
          </Space>
        ) : '-'
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
          scroll={{ x: 1100 }}
        />
      </Card> : null}

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
