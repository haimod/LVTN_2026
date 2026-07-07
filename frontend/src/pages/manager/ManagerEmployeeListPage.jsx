import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Descriptions, Empty, Input, Modal, Row, Select, Space, Table, Tag, Typography, notification } from 'antd';
import { CheckCircleOutlined, EyeOutlined, StopOutlined, TeamOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const getRoleText = (record) => record.roles?.[0]?.name || '-';
const getEmployeeCode = (id) => `NV-${String(id).padStart(5, '0')}`;
const isActive = (value) => value === 1 || value === true;

const ManagerEmployeeListPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: null,
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    let ignore = false;

    const fetchEmployees = async () => {
      try {
        const response = await axiosInstance.get('/manager/employees', {
          params: {
            search: filters.search || undefined,
            status: filters.status || undefined,
          },
        });
        const data = response.data.data ? response.data.data : response.data;

        if (!ignore) {
          setEmployees(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ title: 'Không thể tải danh sách nhân viên phòng ban' });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchEmployees();

    return () => {
      ignore = true;
    };
  }, [filters.search, filters.status]);

  const stats = useMemo(() => employees.reduce((current, employee) => {
    current.total += 1;

    if (employee.is_active === 1 || employee.is_active === true) {
      current.active += 1;
    } else {
      current.inactive += 1;
    }

    return current;
  }, { total: 0, active: 0, inactive: 0 }), [employees]);

  const columns = [
    {
      title: 'Mã nhân viên',
      dataIndex: 'id',
      key: 'id',
      width: 130,
      render: (id) => <strong>{getEmployeeCode(id)}</strong>,
    },
    {
      title: 'Nhân viên',
      key: 'employee',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.name || '-'}</span>
          <Text type="secondary">{record.email || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      render: (value) => value || '-',
    },
    {
      title: 'Phòng ban',
      key: 'department',
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: 'Chức vụ',
      key: 'role',
      render: (_, record) => getRoleText(record),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      align: 'center',
      render: (value) => (
        isActive(value)
          ? <Tag color="green">Đang hoạt động</Tag>
          : <Tag color="red">Đã khóa</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 110,
      render: (_, record) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedEmployee(record)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Nhân viên phòng ban</Title>
        <Text type="secondary">Danh sách nhân viên thuộc phòng ban do bạn phụ trách.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng nhân viên</Text>
              <Space align="center">
                <TeamOutlined style={{ color: '#1677ff', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.total}</Title>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đang hoạt động</Text>
              <Space align="center">
                <CheckCircleOutlined style={{ color: '#389e0d', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.active}</Title>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đã khóa</Text>
              <Space align="center">
                <StopOutlined style={{ color: '#cf1322', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{stats.inactive}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 8 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} md={10}>
            <Input.Search
              placeholder="Tìm tên, email hoặc số điện thoại"
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
              options={[
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Đã khóa' },
              ]}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={employees}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 980 }}
          locale={{ emptyText: <Empty description="Không có nhân viên trong phòng ban" /> }}
        />
      </Card>

      <Modal
        title={selectedEmployee ? `Chi tiết ${getEmployeeCode(selectedEmployee.id)}` : 'Chi tiết nhân viên'}
        open={!!selectedEmployee}
        onCancel={() => setSelectedEmployee(null)}
        footer={<Button onClick={() => setSelectedEmployee(null)}>Đóng</Button>}
        width={720}
      >
        {selectedEmployee ? (
          <Descriptions bordered size="small" column={1} style={{ marginTop: 8 }}>
            <Descriptions.Item label="Mã nhân viên">{getEmployeeCode(selectedEmployee.id)}</Descriptions.Item>
            <Descriptions.Item label="Họ tên">{selectedEmployee.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedEmployee.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{selectedEmployee.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="Phòng ban">{selectedEmployee.department?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Chức vụ">{getRoleText(selectedEmployee)}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {isActive(selectedEmployee.is_active)
                ? <Tag color="green">Đang hoạt động</Tag>
                : <Tag color="red">Đã khóa</Tag>}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </Space>
  );
};

export default ManagerEmployeeListPage;
