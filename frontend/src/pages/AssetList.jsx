import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, notification, Popconfirm, Card, Row, Col, Tag, DatePicker, InputNumber, Upload, Image, QRCode, Descriptions, Timeline, Tooltip, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UploadOutlined, PictureOutlined, QrcodeOutlined, HistoryOutlined, StopOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../utils/axiosInstance';
import { downloadBlobResponse } from '../utils/downloadFile';

const { Text } = Typography;

const statusMap = {
  new: { color: 'green', text: 'Mới nhập kho' },
  in_use: { color: 'blue', text: 'Đang sử dụng' },
  waiting: { color: 'orange', text: 'Chờ bàn giao' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Mất vĩnh viễn' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const eventTypeMap = {
  assigned: { color: 'blue', text: 'Cấp phát' },
  confirmed_handover: { color: 'green', text: 'Xác nhận bàn giao' },
  reported_damage: { color: 'orange', text: 'Báo hỏng' },
  repairing: { color: 'red', text: 'Tiếp nhận bảo trì' },
  repaired: { color: 'green', text: 'Hoàn tất bảo trì' },
  reported_lost: { color: 'volcano', text: 'Báo mất' },
  lost_recovered: { color: 'green', text: 'Tìm lại thiết bị' },
  confirmed_lost: { color: 'red', text: 'Xác nhận mất' },
  return_requested: { color: 'blue', text: 'Yêu cầu trả' },
  returned_to_warehouse: { color: 'green', text: 'Nhận lại kho' },
  disposed: { color: 'gray', text: 'Thanh lý' },
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');
const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toLocaleString('vi-VN')} VNĐ`;
};

const getStatusText = (status) => statusMap[status]?.text || status || '-';

const getApiOrigin = () => {
  try {
    return new URL(axiosInstance.defaults.baseURL).origin;
  } catch {
    return '';
  }
};

const apiOrigin = getApiOrigin();

const getPublicAppUrl = () => {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_APP_PUBLIC_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  return window.location.origin;
};

const publicAppUrl = getPublicAppUrl();

const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const normUploadFile = (event) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

const buildAssetFormData = (values) => {
  const formData = new FormData();

  formData.append('name', values.name);
  formData.append('category_id', values.category_id);
  formData.append('purchase_price', values.purchase_price);
  formData.append('purchase_date', values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : '');
  formData.append('warranty_expiry', values.warranty_expiry ? values.warranty_expiry.format('YYYY-MM-DD') : '');
  formData.append('description', values.description || '');

  const imageFile = values.image?.[0]?.originFileObj;
  if (imageFile) {
    formData.append('image', imageFile);
  }

  return formData;
};

const AssetList = () => {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category_id: null,
    department_id: null,
    status: null,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [detailAsset, setDetailAsset] = useState(null);
  const [qrAsset, setQrAsset] = useState(null);
  const [historyAsset, setHistoryAsset] = useState(null);
  const [assetHistories, setAssetHistories] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [disposingAsset, setDisposingAsset] = useState(null);
  const [disposing, setDisposing] = useState(false);
  const [form] = Form.useForm();
  const [disposeForm] = Form.useForm();

  const currentUser = getCurrentUser();
  const currentRole = currentUser?.role || currentUser?.roles?.[0]?.name;
  const canManageAssets = currentRole === 'admin';
  const canViewAssetActions = currentRole === 'manager';

  const cleanParams = (params) => Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/assets', { params: cleanParams(filters) });
      const data = response.data.data ? response.data.data : response.data;
      setAssets(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Lỗi lấy dữ liệu tài sản' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadAssets = async () => {
      try {
        const params = cleanParams(filters);
        const response = await axiosInstance.get('/assets', { params });
        const data = response.data.data ? response.data.data : response.data;
        if (!ignore) {
          setAssets(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          notification.error({ message: 'Lỗi lấy dữ liệu tài sản' });
        }
      }
    };

    loadAssets();

    return () => {
      ignore = true;
    };
  }, [filters]);

  useEffect(() => {
    let ignore = false;

    const loadDependencies = async () => {
      try {
        const [catRes, deptRes] = await Promise.all([
          axiosInstance.get('/categories'),
          canManageAssets ? axiosInstance.get('/departments') : Promise.resolve({ data: { data: [] } }),
        ]);
        if (!ignore) {
          setCategories(catRes.data.data || []);
          setDepartments(deptRes.data.data || []);
        }
      } catch (error) {
        console.error('Không thể lấy danh mục hoặc phòng ban', error);
      }
    };

    loadDependencies();

    return () => {
      ignore = true;
    };
  }, [canManageAssets]);

  const showModal = (asset = null) => {
    setEditingAsset(asset);
    if (asset) {
      form.setFieldsValue({
        name: asset.name,
        category_id: asset.category_id,
        purchase_price: asset.purchase_price,
        purchase_date: asset.purchase_date ? dayjs(asset.purchase_date) : null,
        warranty_expiry: asset.warranty_expiry ? dayjs(asset.warranty_expiry) : null,
        description: asset.description,
        image: [],
      });
    } else {
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = buildAssetFormData(values);

      setLoading(true);
      if (editingAsset) {
        payload.append('_method', 'PUT');
        await axiosInstance.post(`/assets/${editingAsset.id}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        notification.success({ message: 'Cập nhật tài sản thành công' });
      } else {
        await axiosInstance.post('/assets', payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        notification.success({ message: 'Nhập tài sản mới thành công' });
      }
      setIsModalOpen(false);
      fetchAssets();
    } catch (error) {
      const msg = error.response?.data?.message || 'Vui lòng kiểm tra lại thông tin nhập';
      notification.error({ message: 'Lỗi lưu dữ liệu', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/assets/${id}`);
      notification.success({ message: 'Đã xóa tài sản thành công' });
      fetchAssets();
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể xóa tài sản này';
      notification.error({ message: 'Lỗi khi xóa', description: msg });
    }
  };

  const handleExportAssets = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/assets/export', {
        params: cleanParams(filters),
        responseType: 'blob',
      });
      downloadBlobResponse(response, 'danh-sach-tai-san.csv');
      notification.success({ message: 'Đã xuất file Excel danh sách tài sản' });
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể xuất file danh sách tài sản';
      notification.error({ message: 'Xuất file thất bại', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const canDisposeAsset = (asset) => asset?.status === 'new' && asset?.department_id === null;

  const openDisposeModal = (asset) => {
    disposeForm.resetFields();
    setDisposingAsset(asset);
  };

  const handleDispose = async () => {
    if (!disposingAsset?.id) {
      notification.warning({ message: 'Vui lòng chọn tài sản cần thanh lý' });
      return;
    }

    try {
      const values = await disposeForm.validateFields();
      setDisposing(true);
      await axiosInstance.patch(`/assets/${disposingAsset.id}/dispose`, {
        reason: values.reason,
      });
      notification.success({ message: 'Đã thanh lý tài sản' });
      setDisposingAsset(null);
      fetchAssets();
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể thanh lý tài sản này';
      notification.error({ message: 'Thao tác bị chặn', description: msg });
    } finally {
      setDisposing(false);
    }
  };

  const openHistoryModal = async (asset) => {
    setHistoryAsset(asset);
    setAssetHistories([]);
    setHistoryLoading(true);

    try {
      const response = await axiosInstance.get(`/assets/${asset.id}/histories`);
      const payload = response.data.data ? response.data.data : response.data;
      setHistoryAsset(payload.asset || asset);
      setAssetHistories(Array.isArray(payload.histories) ? payload.histories.slice(0, 1) : []);
    } catch (error) {
      const msg = error.response?.data?.message || 'Không thể tải lịch sử tài sản';
      notification.error({ message: 'Lỗi tải lịch sử', description: msg });
      setHistoryAsset(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const current = statusMap[status] || { color: 'default', text: status || '-' };
    return <Tag color={current.color}>{current.text}</Tag>;
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

  const columns = [
    {
      title: 'Ảnh',
      key: 'image',
      width: 80,
      render: (_, record) => renderImage(record.image_path, record.name),
    },
    {
      title: 'Mã tài sản',
      dataIndex: 'asset_code',
      key: 'asset_code',
      fixed: 'left',
      render: (text) => <strong style={{ color: '#1890ff' }}>{text}</strong>,
    },
    { title: 'Tên tài sản', dataIndex: 'name', key: 'name' },
    {
      title: 'Danh mục',
      key: 'category',
      render: (_, record) => <span>{record.category?.name || '-'}</span>,
    },
    {
      title: 'Vị trí',
      key: 'department',
      render: (_, record) => (
        record.department
          ? <span>{record.department.name}</span>
          : <Tag color="cyan">Kho tổng</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: getStatusTag,
    },
  ];

  if (canManageAssets) {
    columns.push({
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 210,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Sửa tài sản">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#faad14' }} />}
              disabled={record.status !== 'new'}
              onClick={() => showModal(record)}
            />
          </Tooltip>
          <Tooltip title="Mã QR">
            <Button type="text" icon={<QrcodeOutlined style={{ color: '#1677ff' }} />} onClick={() => setQrAsset(record)} />
          </Tooltip>
          <Tooltip title="Lịch sử gần nhất">
            <Button type="text" icon={<HistoryOutlined style={{ color: '#13c2c2' }} />} onClick={() => openHistoryModal(record)} />
          </Tooltip>
          <Tooltip title="Thanh lý">
            <Button
              type="text"
              icon={<StopOutlined style={{ color: '#722ed1' }} />}
              disabled={!canDisposeAsset(record)}
              onClick={() => openDisposeModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa tài sản này?"
            description="Chỉ có thể xóa tài sản mới nhập kho hoặc đã thanh lý."
            onConfirm={() => handleDelete(record.id)}
            okText="Đồng ý"
            cancelText="Hủy"
          >
            <Button type="text" danger icon={<DeleteOutlined />} disabled={!['new', 'disposed'].includes(record.status)} />
          </Popconfirm>
        </Space>
      ),
    });
  } else if (canViewAssetActions) {
    columns.push({
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} onClick={() => setDetailAsset(record)}>
            Chi tiết
          </Button>
          <Tooltip title="Lịch sử gần nhất">
            <Button type="text" icon={<HistoryOutlined style={{ color: '#13c2c2' }} />} onClick={() => openHistoryModal(record)} />
          </Tooltip>
        </Space>
      ),
    });
  }

  const modalStatus = editingAsset ? statusMap[editingAsset.status]?.text || editingAsset.status : 'Mới nhập kho';
  const modalLocation = editingAsset?.department?.name || 'Kho tổng';
  const existingImageUrl = getImageUrl(editingAsset?.image_path);
  const qrValue = qrAsset?.uuid
    ? `${publicAppUrl}/employee/handover?code=${encodeURIComponent(qrAsset.uuid)}`
    : qrAsset?.asset_code || '';

  return (
    <Card
      title={<span style={{ fontSize: '20px', fontWeight: 600 }}>Danh sách Tài sản</span>}
      extra={canManageAssets && (
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={handleExportAssets}>Xuất Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>Nhập Tài sản Mới</Button>
        </Space>
      )}
      style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Input.Search
            placeholder="Tìm theo mã hoặc tên tài sản..."
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onSearch={(value) => setFilters((prev) => ({ ...prev, search: value }))}
            style={{ width: 300 }}
          />
        </Col>
        <Col>
          <Select
            placeholder="Danh mục"
            allowClear
            value={filters.category_id}
            style={{ width: 190 }}
            onChange={(value) => setFilters((prev) => ({ ...prev, category_id: value }))}
          >
            {categories.map((cat) => (
              <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
            ))}
          </Select>
        </Col>
        {canManageAssets && (
          <Col>
            <Select
              placeholder="Phòng ban"
              allowClear
              value={filters.department_id}
              style={{ width: 190 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, department_id: value }))}
            >
              <Select.Option value="warehouse">Kho tổng</Select.Option>
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
              ))}
            </Select>
          </Col>
        )}
        <Col>
          <Select
            placeholder="Trạng thái"
            allowClear
            value={filters.status}
            style={{ width: 180 }}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          >
            {Object.entries(statusMap).map(([value, config]) => (
              <Select.Option key={value} value={value}>{config.text}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchText('');
              setFilters({ search: '', category_id: null, department_id: null, status: null });
            }}
          >
            Làm mới
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={assets}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 850 }}
      />

      <Modal
        title={<span style={{ fontSize: '18px' }}>{editingAsset ? 'Cập nhật Tài sản' : 'Nhập Tài sản Mới'}</span>}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={loading}
        okText="Lưu dữ liệu"
        cancelText="Hủy"
        width={760}
      >
        <Form form={form} layout="vertical" style={{ marginTop: '20px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Tên tài sản" rules={[{ required: true, message: 'Nhập tên tài sản!' }]}>
                <Input placeholder="VD: Laptop Dell XPS 15" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục!' }]}>
                <Select placeholder="-- Chọn loại tài sản --" showSearch optionFilterProp="children">
                  {categories.map((cat) => (
                    <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Trạng thái">
                <Input value={modalStatus} disabled readOnly />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Vị trí">
                <Input value={modalLocation} disabled readOnly />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="purchase_price" label="Giá mua (VNĐ)" rules={[{ required: true, message: 'Nhập giá mua!' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/\$\s?|(\.*)/g, '').replace(/,/g, '')}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purchase_date" label="Ngày mua" rules={[{ required: true, message: 'Chọn ngày mua!' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warranty_expiry" label="Hạn bảo hành">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="image"
                label="Ảnh thiết bị"
                valuePropName="fileList"
                getValueFromEvent={normUploadFile}
              >
                <Upload
                  accept="image/png,image/jpeg,image/webp"
                  beforeUpload={() => false}
                  maxCount={1}
                  listType="picture"
                >
                  <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                </Upload>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ảnh hiện tại">
                {existingImageUrl ? (
                  <Image width={120} height={86} src={existingImageUrl} style={{ objectFit: 'cover', borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 120, height: 86, border: '1px solid #f0f0f0', borderRadius: 6, display: 'grid', placeItems: 'center', color: '#bfbfbf', background: '#fafafa' }}>
                    <PictureOutlined />
                  </div>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả cấu hình / Chi tiết">
            <Input.TextArea rows={3} placeholder="Ví dụ: Core i7-12700H, RAM 16GB, SSD 512GB..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Mã QR tài sản"
        open={!!qrAsset}
        onCancel={() => setQrAsset(null)}
        footer={<Button onClick={() => setQrAsset(null)}>Đóng</Button>}
        width={360}
      >
        {qrAsset && (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12, paddingTop: 8 }}>
            <QRCode value={qrValue} size={220} />
            <strong>{qrAsset.asset_code}</strong>
            <span style={{ textAlign: 'center' }}>{qrAsset.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666', wordBreak: 'break-all', textAlign: 'center' }}>{qrValue}</span>
          </div>
        )}
      </Modal>

      <Modal
        title={detailAsset ? `Chi tiết ${detailAsset.asset_code}` : 'Chi tiết tài sản'}
        open={!!detailAsset}
        onCancel={() => setDetailAsset(null)}
        footer={<Button onClick={() => setDetailAsset(null)}>Đóng</Button>}
        width={820}
      >
        {detailAsset ? (
          <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 8 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Mã tài sản">{detailAsset.asset_code}</Descriptions.Item>
              <Descriptions.Item label="Tên tài sản">{detailAsset.name}</Descriptions.Item>
              <Descriptions.Item label="Danh mục">{detailAsset.category?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Vị trí">{detailAsset.department?.name || 'Kho tổng'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{getStatusTag(detailAsset.status)}</Descriptions.Item>
              <Descriptions.Item label="Giá mua">{formatCurrency(detailAsset.purchase_price)}</Descriptions.Item>
              <Descriptions.Item label="Ngày mua">{formatDate(detailAsset.purchase_date)}</Descriptions.Item>
              <Descriptions.Item label="Hạn bảo hành">{formatDate(detailAsset.warranty_expiry)}</Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>{detailAsset.description || '-'}</Descriptions.Item>
            </Descriptions>

            {getImageUrl(detailAsset.image_path) ? (
              <Image
                width={160}
                height={110}
                src={getImageUrl(detailAsset.image_path)}
                alt={detailAsset.name}
                style={{ objectFit: 'cover', borderRadius: 6 }}
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>

      <Modal
        title={disposingAsset ? `Thanh lý ${disposingAsset.asset_code}` : 'Thanh lý tài sản'}
        open={!!disposingAsset}
        onOk={handleDispose}
        onCancel={() => setDisposingAsset(null)}
        confirmLoading={disposing}
        okText="Xác nhận thanh lý"
        cancelText="Hủy"
      >
        <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
          <Text type="secondary">
            Chỉ thanh lý tài sản đang ở kho tổng và trạng thái mới nhập kho. Sau khi xác nhận, tài sản chuyển sang trạng thái đã thanh lý.
          </Text>
          <Form form={disposeForm} layout="vertical">
            <Form.Item
              name="reason"
              label="Lý do thanh lý"
              rules={[
                { required: true, message: 'Vui lòng nhập lý do thanh lý' },
                { min: 5, message: 'Lý do cần tối thiểu 5 ký tự' },
              ]}
            >
              <Input.TextArea rows={4} placeholder="Ví dụ: hết khấu hao, hư hỏng không còn giá trị sử dụng, thay thế thiết bị mới..." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title={historyAsset ? `Lịch sử gần nhất ${historyAsset.asset_code}` : 'Lịch sử gần nhất'}
        open={!!historyAsset}
        onCancel={() => setHistoryAsset(null)}
        footer={<Button onClick={() => setHistoryAsset(null)}>Đóng</Button>}
        width={820}
      >
        {historyAsset && (
          <Space direction="vertical" size={18} style={{ width: '100%', marginTop: 8 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Mã tài sản">{historyAsset.asset_code}</Descriptions.Item>
              <Descriptions.Item label="Tên tài sản">{historyAsset.name}</Descriptions.Item>
              <Descriptions.Item label="Danh mục">{historyAsset.category?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Vị trí">{historyAsset.department?.name || 'Kho tổng'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{getStatusTag(historyAsset.status)}</Descriptions.Item>
            </Descriptions>

            <Text type="secondary">Giao diện chỉ hiển thị mốc gần nhất. File xuất Excel có toàn bộ lịch sử của tài sản.</Text>

            <Timeline
              pending={historyLoading ? 'Đang tải lịch sử...' : false}
              items={assetHistories.length ? assetHistories.map((item) => {
                const event = eventTypeMap[item.event_type] || { color: 'gray', text: item.event_type || 'Sự kiện' };

                return {
                  color: event.color,
                  children: (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space wrap>
                        <strong>{event.text}</strong>
                        <Text type="secondary">{formatDateTime(item.created_at)}</Text>
                      </Space>
                      <Space wrap>
                        <Tag color="default">{getStatusText(item.old_status)}</Tag>
                        <span>→</span>
                        <Tag color={statusMap[item.new_status]?.color || 'default'}>{getStatusText(item.new_status)}</Tag>
                      </Space>
                      <Text>Người thao tác: {item.user?.name || '-'}</Text>
                      {item.note ? <Text type="secondary">{item.note}</Text> : null}
                    </Space>
                  ),
                };
              }) : [{
                color: 'gray',
                children: historyLoading ? 'Đang tải lịch sử...' : 'Chưa có lịch sử cho tài sản này.',
              }]}
            />
          </Space>
        )}
      </Modal>
    </Card>
  );
};

export default AssetList;
