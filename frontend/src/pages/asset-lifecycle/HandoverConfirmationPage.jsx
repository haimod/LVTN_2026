import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Image, Input, Modal, Row, Skeleton, Space, Tag, Typography, Upload, notification } from 'antd';
import { CameraOutlined, CheckOutlined, FileImageOutlined, QrcodeOutlined, RollbackOutlined, StopOutlined, ToolOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const assetStatusMap = {
  new: { color: 'green', text: 'Trong kho' },
  waiting: { color: 'gold', text: 'Chờ bàn giao' },
  in_use: { color: 'blue', text: 'Đang sử dụng' },
  repairing: { color: 'red', text: 'Đang bảo trì' },
  under_investigation: { color: 'volcano', text: 'Đang điều tra mất' },
  permanently_lost: { color: 'black', text: 'Đã báo mất' },
  disposed: { color: 'default', text: 'Đã thanh lý' },
};

const getStatusTag = (status) => {
  const current = assetStatusMap[status] || { color: 'default', text: status || '-' };
  return <Tag color={current.color}>{current.text}</Tag>;
};

const normUploadFile = (event) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

const formatDateTime = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-');
const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '-');
const MAX_DAMAGE_IMAGE_SIZE = 1.8 * 1024 * 1024;
const MAX_DAMAGE_IMAGE_DIMENSION = 1600;

const isLocalhost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const isCameraBlockedByContext = () => !window.isSecureContext && !isLocalhost();

const getApiOrigin = () => {
  try {
    return new URL(axiosInstance.defaults.baseURL).origin;
  } catch {
    return '';
  }
};

const apiOrigin = getApiOrigin();

const getImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}/${path.replace(/^\/+/, '')}`;
};

const loadImageElement = (file) => new Promise((resolve, reject) => {
  const image = document.createElement('img');
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Cannot load image'));
  };

  image.src = objectUrl;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, type, quality);
});

const prepareDamageImage = async (file) => {
  if (!file || file.size <= MAX_DAMAGE_IMAGE_SIZE) {
    return file;
  }

  const image = await loadImageElement(file);
  const ratio = Math.min(1, MAX_DAMAGE_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const compressedBlob = await canvasToBlob(canvas, 'image/jpeg', 0.82);

  if (!compressedBlob) {
    return file;
  }

  return new File([compressedBlob], `${file.name.replace(/\.[^.]+$/, '') || 'damage-photo'}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

const HandoverConfirmationPage = () => {
  const [form] = Form.useForm();
  const [damageForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [searchParams] = useSearchParams();
  const qrCode = searchParams.get('code');
  const isQrLink = Boolean(qrCode);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [damageOpen, setDamageOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  const asset = result?.asset;
  const assignment = result?.assignment;
  const imageUrl = getImageUrl(asset?.image_path);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraActive(false);
  }, []);

  const inspectCode = useCallback(async (rawCode) => {
    const assetUuid = rawCode?.trim();
    if (!assetUuid) {
      notification.warning({ message: 'Vui lòng nhập hoặc quét mã QR' });
      return;
    }

    try {
      setLoading(true);
      setSession(null);
      const response = await axiosInstance.post('/handover-sessions', { asset_uuid: assetUuid });
      const payload = response.data.data ? response.data.data : response.data;
      setResult(payload);

      if (payload?.can_confirm) {
        setSession(payload);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể kiểm tra mã QR';
      setResult(null);
      notification.error({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const startCamera = async () => {
    if (isCameraBlockedByContext()) {
      notification.warning({
        message: 'Trình duyệt đang chặn camera',
        description: 'Camera trực tiếp trên điện thoại cần HTTPS. Với mạng nội bộ, hãy dùng camera điện thoại quét tem QR để mở link, hoặc nhập/dán mã QR vào ô kiểm tra.',
        duration: 6,
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      notification.warning({ message: 'Trình duyệt này không hỗ trợ mở camera trực tiếp.' });
      return;
    }

    if (!('BarcodeDetector' in window)) {
      notification.warning({ message: 'Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Bạn có thể dùng camera điện thoại quét tem để mở link.' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      streamRef.current = stream;
      setCameraActive(true);

      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 0);

      scanTimerRef.current = window.setInterval(async () => {
        try {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            return;
          }

          const codes = await detector.detect(videoRef.current);
          const rawValue = codes?.[0]?.rawValue;

          if (rawValue) {
            form.setFieldsValue({ asset_uuid: rawValue });
            stopCamera();
            inspectCode(rawValue);
          }
        } catch {
          // Keep scanning until the user stops the camera or a QR code is found.
        }
      }, 700);
    } catch {
      notification.error({ message: 'Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera.' });
      stopCamera();
    }
  };

  const handleConfirm = async () => {
    if (!session?.token) {
      notification.warning({ message: 'Phiên xác nhận đã hết hạn. Vui lòng quét lại QR.' });
      return;
    }

    try {
      setConfirming(true);
      const response = await axiosInstance.post(`/handover-sessions/${session.token}/confirm`);
      const data = response.data.data ? response.data.data : response.data;
      notification.success({ message: 'Đã xác nhận nhận tài sản' });
      window.dispatchEvent(new Event('notifications-updated'));
      setSession(null);
      setResult({
        can_confirm: false,
        can_report_damage: true,
        can_request_return: true,
        asset: data.asset,
        assignment: data,
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể xác nhận bàn giao';
      notification.error({ message });
    } finally {
      setConfirming(false);
    }
  };

  const handleReportDamage = async () => {
    if (!asset?.uuid) {
      notification.warning({ message: 'Vui lòng quét lại QR trước khi báo hỏng' });
      return;
    }

    try {
      const values = await damageForm.validateFields();
      const payload = new FormData();
      payload.append('asset_uuid', asset.uuid);
      payload.append('description', values.description);

      const imageFile = values.image?.[0]?.originFileObj || values.image?.[0];
      if (imageFile) {
        const preparedImage = await prepareDamageImage(imageFile);

        if (preparedImage.size > MAX_DAMAGE_IMAGE_SIZE) {
          notification.error({ message: 'Ảnh quá lớn', description: 'Vui lòng chọn ảnh nhỏ hơn 2MB hoặc chụp lại ảnh rõ hơn.' });
          return;
        }

        payload.append('image', preparedImage, preparedImage.name || 'damage-photo.jpg');
      }

      setReporting(true);
      await axiosInstance.post('/maintenance-records/report', payload);

      notification.success({ message: 'Đã gửi phiếu báo hỏng thiết bị' });
      window.dispatchEvent(new Event('notifications-updated'));
      damageForm.resetFields();
      setDamageOpen(false);
      inspectCode(asset.uuid);
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể gửi phiếu báo hỏng';
      notification.error({ message });
    } finally {
      setReporting(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!assignment?.id || !asset?.uuid) {
      notification.warning({ message: 'Vui lòng quét lại QR trước khi gửi yêu cầu trả' });
      return;
    }

    try {
      const values = await returnForm.validateFields();
      setReturning(true);
      await axiosInstance.post('/return-requests/request', {
        assignment_id: assignment.id,
        return_reason: values.return_reason || '',
      });

      notification.success({ message: 'Đã gửi yêu cầu trả thiết bị cho admin' });
      window.dispatchEvent(new Event('notifications-updated'));
      returnForm.resetFields();
      setReturnOpen(false);
      inspectCode(asset.uuid);
    } catch (error) {
      const message = error.response?.data?.message || 'Không thể gửi yêu cầu trả thiết bị';
      notification.error({ message });
    } finally {
      setReturning(false);
    }
  };

  useEffect(() => {
    if (qrCode) {
      form.setFieldsValue({ asset_uuid: qrCode });
      const timer = window.setTimeout(() => inspectCode(qrCode), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [form, inspectCode, qrCode]);

  useEffect(() => stopCamera, [stopCamera]);

  const renderWorkflowNotice = () => {
    if (!asset) {
      return null;
    }

    if (result?.is_blacklisted) {
      return (
        <Alert
          type="error"
          showIcon
          message="Thiết bị đang nằm trong luồng báo mất"
          description="Không thể xác nhận, báo hỏng hoặc yêu cầu trả bằng QR này cho đến khi admin xử lý hồ sơ báo mất."
        />
      );
    }

    if (asset.status === 'disposed') {
      return <Alert type="info" showIcon message="Thiết bị đã thanh lý" description="QR chỉ dùng để tra cứu thông tin thiết bị." />;
    }

    if (result?.can_confirm) {
      return <Alert type="success" showIcon message="Thiết bị đang chờ bạn xác nhận nhận tài sản" description="Kiểm tra đúng mã máy và tình trạng vật lý trước khi xác nhận." />;
    }

    if (assignment?.return_requested_at) {
      return <Alert type="info" showIcon message="Đã gửi yêu cầu trả thiết bị" description="Phiếu mượn sẽ đóng khi admin xác nhận đã nhận lại thiết bị." />;
    }

    if (result?.can_report_damage || result?.can_request_return) {
      return <Alert type="info" showIcon message="Bạn đang giữ thiết bị này" description="Có thể báo hỏng hoặc yêu cầu trả thiết bị bằng các nút bên dưới." />;
    }

    return <Alert type="warning" showIcon message="Chỉ được xem thông tin" description="Thiết bị này không nằm trong phiếu bàn giao đang chờ xác nhận của tài khoản hiện tại." />;
  };

  const renderActionButtons = () => {
    if (!asset || result?.is_blacklisted || asset.status === 'disposed') {
      return null;
    }

    if (result?.can_confirm) {
      return (
        <div style={{ border: '1px solid #d9f7be', background: '#fcfffa', borderRadius: 8, padding: 16 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Title level={5} style={{ margin: 0 }}>Phiếu xác nhận nhận thiết bị</Title>
              <Text type="secondary">Chỉ bấm xác nhận khi đúng thiết bị thực tế và đúng người đang đăng nhập.</Text>
            </div>

            <Form layout="vertical">
              <Row gutter={[12, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item label="Mã tài sản" style={{ marginBottom: 8 }}>
                    <Input value={asset.asset_code || '-'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item label="Tên thiết bị" style={{ marginBottom: 8 }}>
                    <Input value={asset.name || '-'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Danh mục" style={{ marginBottom: 8 }}>
                    <Input value={asset.category?.name || '-'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Người nhận" style={{ marginBottom: 8 }}>
                    <Input value={assignment?.user?.name || '-'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Trạng thái hiện tại" style={{ marginBottom: 8 }}>
                    <Input value={assetStatusMap[asset.status]?.text || asset.status || '-'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Ngày dự kiến trả" style={{ marginBottom: 8 }}>
                    <Input value={formatDate(assignment?.expected_return_date)} disabled />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Button type="primary" icon={<CheckOutlined />} loading={confirming} onClick={handleConfirm}>
              Xác nhận nhận tài sản
            </Button>
          </Space>
        </div>
      );
    }

    if (result?.can_report_damage || result?.can_request_return) {
      return (
        <Space wrap>
          {result?.can_report_damage ? (
            <Button danger type="primary" icon={<ToolOutlined />} onClick={() => setDamageOpen(true)}>
              Báo hỏng
            </Button>
          ) : null}
          {result?.can_request_return ? (
            <Button type="primary" icon={<RollbackOutlined />} onClick={() => setReturnOpen(true)}>
              Yêu cầu trả thiết bị
            </Button>
          ) : null}
        </Space>
      );
    }

    return null;
  };

  const renderAssetInfo = () => {
    if (loading && !asset) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!asset) {
      return (
        <Alert
          type="info"
          showIcon
          message={isQrLink ? 'Đang chờ thông tin thiết bị' : 'Chưa có thiết bị'}
          description={isQrLink ? 'Hệ thống đang đọc mã QR trên thiết bị.' : 'Nhập mã hoặc mở camera để kiểm tra QR.'}
        />
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={asset.name}
                width="100%"
                height={220}
                style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
              />
            ) : (
              <div style={{ height: 220, border: '1px solid #f0f0f0', borderRadius: 8, display: 'grid', placeItems: 'center', color: '#bfbfbf', background: '#fafafa' }}>
                <Space direction="vertical" align="center">
                  <FileImageOutlined style={{ fontSize: 28 }} />
                  <Text type="secondary">Chưa có ảnh thiết bị</Text>
                </Space>
              </div>
            )}
          </Col>

          <Col xs={24} md={16}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{asset.asset_code}</Title>
                  <Text type="secondary">{asset.name}</Text>
                </div>
                {getStatusTag(asset.status)}
              </Space>

              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Tên thiết bị">{asset.name}</Descriptions.Item>
                <Descriptions.Item label="Danh mục">{asset.category?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Vị trí/phòng ban">{asset.department?.name || 'Kho tổng'}</Descriptions.Item>
                <Descriptions.Item label="Người được cấp phát">{assignment?.user?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Người cấp phát">{assignment?.assigned_by?.name || assignment?.assignedBy?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Ngày cấp phát">{formatDateTime(assignment?.assigned_at)}</Descriptions.Item>
                <Descriptions.Item label="Ngày dự kiến trả">{formatDate(assignment?.expected_return_date)}</Descriptions.Item>
                <Descriptions.Item label="Ngày xác nhận">{formatDateTime(assignment?.confirmed_at)}</Descriptions.Item>
                <Descriptions.Item label="Hạn xác nhận">{session?.expires_at ? dayjs(session.expires_at).format('DD/MM/YYYY HH:mm:ss') : '-'}</Descriptions.Item>
              </Descriptions>
            </Space>
          </Col>
        </Row>

        {renderWorkflowNotice()}
        {renderActionButtons()}
      </Space>
    );
  };

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>{isQrLink ? 'Thông tin thiết bị' : 'Quét QR thiết bị'}</Title>
        <Text type="secondary">{isQrLink ? 'Thông tin và thao tác theo tem QR dán trên thiết bị.' : 'Dùng khi cần kiểm tra mã QR thủ công trong hệ thống.'}</Text>
      </div>

      <Row gutter={[16, 16]}>
        {!isQrLink ? (
          <Col xs={24} lg={9}>
            <Card title="Kiểm tra QR" bordered={false} style={{ borderRadius: 8 }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Form form={form} layout="vertical" onFinish={(values) => inspectCode(values.asset_uuid)}>
                  <Form.Item
                    name="asset_uuid"
                    label="Mã QR hoặc đường dẫn QR"
                    rules={[{ required: true, message: 'Vui lòng nhập mã QR' }]}
                  >
                    <Input.TextArea rows={3} placeholder="Dán UUID hoặc đường dẫn QR vào đây" />
                  </Form.Item>

                  <Space wrap>
                    <Button type="primary" htmlType="submit" icon={<QrcodeOutlined />} loading={loading}>
                      Kiểm tra QR
                    </Button>
                    {!cameraActive ? (
                      <Button icon={<CameraOutlined />} onClick={startCamera}>
                        Mở camera
                      </Button>
                    ) : (
                      <Button danger icon={<StopOutlined />} onClick={stopCamera}>
                        Tắt camera
                      </Button>
                    )}
                  </Space>
                </Form>

                {isCameraBlockedByContext() ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Camera trực tiếp cần HTTPS"
                    description="Khi mở bằng địa chỉ mạng nội bộ, điện thoại có thể chặn camera trong trình duyệt. Hãy quét tem QR bằng camera hệ điều hành để mở link thiết bị."
                  />
                ) : null}

                {cameraActive ? (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, background: '#111' }}
                  />
                ) : null}
              </Space>
            </Card>
          </Col>
        ) : null}

        <Col xs={24} lg={isQrLink ? 24 : 15}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            {renderAssetInfo()}
          </Card>
        </Col>
      </Row>

      <Modal
        title={asset ? `Báo hỏng ${asset.asset_code}` : 'Báo hỏng thiết bị'}
        open={damageOpen}
        onCancel={() => setDamageOpen(false)}
        onOk={handleReportDamage}
        okText="Gửi báo hỏng"
        cancelText="Hủy"
        confirmLoading={reporting}
        destroyOnHidden
      >
        <Form form={damageForm} layout="vertical">
          <Form.Item
            name="description"
            label="Mô tả sự cố"
            rules={[
              { required: true, message: 'Vui lòng nhập mô tả sự cố' },
              { min: 10, message: 'Mô tả cần tối thiểu 10 ký tự' },
            ]}
          >
            <Input.TextArea rows={4} placeholder="Mô tả hiện tượng lỗi, thời điểm phát hiện, tình trạng hiện tại..." />
          </Form.Item>

          <Form.Item
            name="image"
            label="Ảnh minh chứng"
            valuePropName="fileList"
            getValueFromEvent={normUploadFile}
          >
            <Upload
              accept="image/*"
              capture="environment"
              beforeUpload={() => false}
              maxCount={1}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Chọn/chụp ảnh</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={asset ? `Yêu cầu trả ${asset.asset_code}` : 'Yêu cầu trả thiết bị'}
        open={returnOpen}
        onCancel={() => setReturnOpen(false)}
        onOk={handleRequestReturn}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        confirmLoading={returning}
        destroyOnHidden
      >
        <Form form={returnForm} layout="vertical">
          <Form.Item name="return_reason" label="Ghi chú khi trả">
            <Input.TextArea rows={4} placeholder="Tình trạng thiết bị khi trả, phụ kiện đi kèm, ghi chú nếu có..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default HandoverConfirmationPage;
