import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Row, Space, Table, Tag, Typography, notification } from 'antd';
import { AppstoreOutlined, DownloadOutlined, FileDoneOutlined, ReloadOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons';
import axiosInstance from '../../utils/axiosInstance';
import { downloadBlobResponse } from '../../utils/downloadFile';

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

const formatMoney = (value) => Number(value || 0).toLocaleString('vi-VN');

const makeRows = (items, nameKey) => (Array.isArray(items) ? items.map((item, index) => ({
  key: `${item[nameKey] || item.status || index}`,
  name: item[nameKey] || item.status || '-',
  status: item.status,
  total: item.total || 0,
})) : []);

const AdminReportsPage = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/reports/overview');
      const data = response.data.data ? response.data.data : response.data;
      setReport(data);
    } catch {
      notification.error({ message: 'Không thể tải báo cáo kiểm kê' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadReport, 0);
    return () => window.clearTimeout(timer);
  }, [loadReport]);

  const handleExportReport = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/reports/overview/export', {
        responseType: 'blob',
      });
      downloadBlobResponse(response, 'bao-cao-kiem-ke.csv');
      notification.success({ message: 'Đã xuất file Excel báo cáo kiểm kê' });
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể xuất file báo cáo kiểm kê';
      notification.error({ message: 'Xuất file thất bại', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const statusRows = useMemo(() => makeRows(report?.assets_by_status, 'status'), [report]);
  const categoryRows = useMemo(() => makeRows(report?.assets_by_category, 'category_name'), [report]);
  const departmentRows = useMemo(() => makeRows(report?.assets_by_department, 'department_name'), [report]);

  const assetSummary = report?.asset_summary || {};
  const borrowSummary = report?.borrow_summary || {};
  const issueSummary = report?.issue_summary || {};

  const statusColumns = [
    {
      title: 'Trạng thái',
      key: 'name',
      render: (_, record) => {
        const current = statusMap[record.status] || { color: 'default', text: record.name };
        return <Tag color={current.color}>{current.text}</Tag>;
      },
    },
    { title: 'Số lượng', dataIndex: 'total', key: 'total', align: 'right' },
  ];

  const simpleColumns = [
    { title: 'Tên', dataIndex: 'name', key: 'name' },
    { title: 'Số lượng', dataIndex: 'total', key: 'total', align: 'right' },
  ];

  const workflowRows = [
    { key: 'pending_manager', name: 'Yêu cầu chờ trưởng phòng', total: borrowSummary.requests_pending_manager || 0 },
    { key: 'waiting_admin', name: 'Yêu cầu chờ admin cấp phát', total: borrowSummary.requests_waiting_admin || 0 },
    { key: 'out_of_stock', name: 'Yêu cầu chờ nhập kho', total: borrowSummary.requests_out_of_stock || 0 },
    { key: 'waiting_confirm', name: 'Phiếu chờ user xác nhận QR', total: borrowSummary.assignments_waiting_confirm || 0 },
    { key: 'active', name: 'Thiết bị đang mượn', total: borrowSummary.assignments_active || 0 },
    { key: 'return_waiting', name: 'Yêu cầu trả chờ admin nhận', total: borrowSummary.return_waiting_admin || 0 },
    { key: 'returned', name: 'Phiếu đã trả', total: borrowSummary.assignments_returned || 0 },
  ];

  const issueRows = [
    { key: 'maintenance_pending', name: 'Báo hỏng chờ tiếp nhận', total: issueSummary.maintenance_pending || 0 },
    { key: 'maintenance_repairing', name: 'Đang bảo trì', total: issueSummary.maintenance_repairing || 0 },
    { key: 'lost_pending', name: 'Báo mất chờ xử lý', total: issueSummary.lost_pending || 0 },
    { key: 'lost_permanent', name: 'Đã xác nhận mất vĩnh viễn', total: issueSummary.lost_permanent || 0 },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <div>
          <Title level={3} style={{ margin: 0 }}>Báo cáo kiểm kê</Title>
          <Text type="secondary">Tổng hợp tình trạng tài sản, luồng mượn trả và sự cố hiện tại.</Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={handleExportReport} loading={loading}>Xuất Excel</Button>
          <Button icon={<ReloadOutlined />} onClick={loadReport} loading={loading}>Làm mới</Button>
        </Space>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Tổng tài sản</Text>
              <Space align="center">
                <AppstoreOutlined style={{ color: '#1677ff', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{assetSummary.total || 0}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Sẵn sàng trong kho</Text>
              <Space align="center">
                <FileDoneOutlined style={{ color: '#389e0d', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>{assetSummary.warehouse || 0}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Đang xử lý sự cố</Text>
              <Space align="center">
                <ToolOutlined style={{ color: '#d48806', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0 }}>
                  {(issueSummary.maintenance_pending || 0) + (issueSummary.maintenance_repairing || 0) + (issueSummary.lost_pending || 0)}
                </Title>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false} style={{ borderRadius: 8 }} loading={loading}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Giá trị đang quản lý</Text>
              <Space align="center">
                <WarningOutlined style={{ color: '#722ed1', fontSize: 24 }} />
                <Title level={2} style={{ margin: 0, fontSize: 28 }}>{formatMoney(assetSummary.active_value)}</Title>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Tài sản theo trạng thái" bordered={false} style={{ borderRadius: 8 }}>
            <Table
              columns={statusColumns}
              dataSource={statusRows}
              rowKey="key"
              loading={loading}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Tài sản theo danh mục" bordered={false} style={{ borderRadius: 8 }}>
            <Table
              columns={simpleColumns}
              dataSource={categoryRows}
              rowKey="key"
              loading={loading}
              pagination={{ pageSize: 6 }}
              size="small"
              locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Tài sản theo phòng ban" bordered={false} style={{ borderRadius: 8 }}>
            <Table
              columns={simpleColumns}
              dataSource={departmentRows}
              rowKey="key"
              loading={loading}
              pagination={{ pageSize: 6 }}
              size="small"
              locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Luồng mượn trả" bordered={false} style={{ borderRadius: 8 }}>
            <Table
              columns={simpleColumns}
              dataSource={workflowRows}
              rowKey="key"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Sự cố và mất thiết bị" bordered={false} style={{ borderRadius: 8 }}>
            <Table
              columns={simpleColumns}
              dataSource={issueRows}
              rowKey="key"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default AdminReportsPage;
