import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Form, Input, Row, Space, Tag, Typography, Upload, notification } from 'antd';
import { CameraOutlined, CheckOutlined, QrcodeOutlined, RollbackOutlined, StopOutlined, ToolOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const { Title, Text } = Typography;

const getStatusTag = (canConfirm) => (
  canConfirm ? <Tag color="green">Co the xac nhan</Tag> : <Tag color="default">Chi doc</Tag>
);

const normUploadFile = (event) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

const HandoverConfirmationPage = () => {
  const [form] = Form.useForm();
  const [damageForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

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
      notification.warning({ message: 'Vui long nhap hoac quet ma QR' });
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
        notification.success({ message: 'Ma QR hop le, phien xac nhan co hieu luc 5 phut' });
      } else {
        notification.info({ message: response.data.message || 'Ma QR chi duoc xem thong tin' });
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Khong the kiem tra ma QR';
      setResult(null);
      notification.error({ message });
    } finally {
      setLoading(false);
    }
  }, []);

  const startCamera = async () => {
    if (!('BarcodeDetector' in window)) {
      notification.warning({ message: 'Trinh duyet nay chua ho tro quet QR truc tiep. Ban co the nhap ma thu cong.' });
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
      notification.error({ message: 'Khong the mo camera. Vui long kiem tra quyen truy cap camera.' });
      stopCamera();
    }
  };

  const handleConfirm = async () => {
    if (!session?.token) {
      notification.warning({ message: 'Vui long quet lai QR de tao phien xac nhan' });
      return;
    }

    try {
      setConfirming(true);
      const response = await axiosInstance.post(`/handover-sessions/${session.token}/confirm`);
      const data = response.data.data ? response.data.data : response.data;
      notification.success({ message: 'Da xac nhan nhan tai san' });
      window.dispatchEvent(new Event('notifications-updated'));
      setSession(null);
      setResult({
        can_confirm: false,
        asset: data.asset,
        assignment: data,
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Khong the xac nhan ban giao';
      notification.error({ message });
    } finally {
      setConfirming(false);
    }
  };

  const handleReportDamage = async () => {
    if (!asset?.uuid) {
      notification.warning({ message: 'Vui long quet lai QR truoc khi bao hong' });
      return;
    }

    try {
      const values = await damageForm.validateFields();
      const payload = new FormData();
      payload.append('asset_uuid', asset.uuid);
      payload.append('description', values.description);

      const imageFile = values.image?.[0]?.originFileObj;
      if (imageFile) {
        payload.append('image', imageFile);
      }

      setReporting(true);
      await axiosInstance.post('/maintenance-records/report', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      notification.success({ message: 'Da gui phieu bao hong thiet bi' });
      window.dispatchEvent(new Event('notifications-updated'));
      damageForm.resetFields();
      inspectCode(asset.uuid);
    } catch (error) {
      const message = error.response?.data?.message || 'Khong the gui phieu bao hong';
      notification.error({ message });
    } finally {
      setReporting(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!assignment?.id || !asset?.uuid) {
      notification.warning({ message: 'Vui long quet lai QR truoc khi gui yeu cau tra' });
      return;
    }

    try {
      const values = await returnForm.validateFields();
      setReturning(true);
      await axiosInstance.post('/return-requests/request', {
        assignment_id: assignment.id,
        return_reason: values.return_reason || '',
      });

      notification.success({ message: 'Da gui yeu cau tra thiet bi cho admin' });
      window.dispatchEvent(new Event('notifications-updated'));
      returnForm.resetFields();
      inspectCode(asset.uuid);
    } catch (error) {
      const message = error.response?.data?.message || 'Khong the gui yeu cau tra thiet bi';
      notification.error({ message });
    } finally {
      setReturning(false);
    }
  };

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      form.setFieldsValue({ asset_uuid: code });
      const timer = window.setTimeout(() => inspectCode(code), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [form, inspectCode, searchParams]);

  useEffect(() => stopCamera, [stopCamera]);

  const asset = result?.asset;
  const assignment = result?.assignment;

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ margin: 0 }}>Xac nhan ban giao QR</Title>
        <Text type="secondary">Quet ma QR tren thiet bi de xac nhan ban da nhan dung tai san duoc cap phat.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Form form={form} layout="vertical" onFinish={(values) => inspectCode(values.asset_uuid)}>
                <Form.Item
                  name="asset_uuid"
                  label="Ma QR / duong dan QR"
                  rules={[{ required: true, message: 'Vui long nhap ma QR' }]}
                >
                  <Input.TextArea rows={3} placeholder="Quet QR hoac dan UUID/duong dan QR vao day" />
                </Form.Item>

                <Space wrap>
                  <Button type="primary" htmlType="submit" icon={<QrcodeOutlined />} loading={loading}>
                    Kiem tra QR
                  </Button>
                  {!cameraActive ? (
                    <Button icon={<CameraOutlined />} onClick={startCamera}>
                      Mo camera
                    </Button>
                  ) : (
                    <Button danger icon={<StopOutlined />} onClick={stopCamera}>
                      Tat camera
                    </Button>
                  )}
                </Space>
              </Form>

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

        <Col xs={24} lg={14}>
          <Card bordered={false} style={{ borderRadius: 8 }}>
            {!asset ? (
              <Alert
                type="info"
                showIcon
                message="Chua co thiet bi"
                description="Nhap hoac quet ma QR de xem thong tin ban giao."
              />
            ) : (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Title level={4} style={{ margin: 0 }}>{asset.asset_code}</Title>
                  {result?.is_blacklisted ? <Tag color="red">Blacklist</Tag> : getStatusTag(result?.can_confirm)}
                </Space>

                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Ten thiet bi">{asset.name}</Descriptions.Item>
                  <Descriptions.Item label="Danh muc">{asset.category?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Trang thai hien tai">{asset.status || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Nguoi cap phat">{assignment?.assigned_by?.name || assignment?.assignedBy?.name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ngay cap phat">
                    {assignment?.assigned_at ? dayjs(assignment.assigned_at).format('DD/MM/YYYY HH:mm') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Han xac nhan">
                    {session?.expires_at ? dayjs(session.expires_at).format('DD/MM/YYYY HH:mm:ss') : '-'}
                  </Descriptions.Item>
                </Descriptions>

                {result?.is_blacklisted ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Thiet bi dang nam trong luong bao mat"
                    description="QR nay chi duoc xem thong tin. Khong the xac nhan ban giao hoac bao hong cho den khi admin xu ly phieu bao mat."
                  />
                ) : result?.can_confirm ? (
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={confirming}
                    onClick={handleConfirm}
                  >
                    Xac nhan nhan tai san
                  </Button>
                ) : assignment?.return_requested_at ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Da gui yeu cau tra thiet bi"
                    description="Vui long ban giao thiet bi truc tiep cho admin. Phieu muon se dong khi admin xac nhan da nhan lai."
                  />
                ) : result?.can_report_damage || result?.can_request_return ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Ban dang giu thiet bi nay"
                    description="Co the bao hong hoac gui yeu cau tra thiet bi ben duoi. Phieu muon chi dong khi admin tiep nhan/xac nhan."
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    message="Khong the xac nhan bang ma QR nay"
                    description="Thiet bi nay khong nam trong phieu ban giao dang cho tai khoan hien tai xac nhan."
                  />
                )}

                {result?.can_report_damage || result?.can_request_return ? (
                  <Row gutter={[12, 12]}>
                    {result?.can_report_damage ? (
                      <Col xs={24} xl={12}>
                        <Card size="small" title="Bao hong thiet bi" bordered>
                          <Form form={damageForm} layout="vertical">
                            <Form.Item
                              name="description"
                              label="Mo ta su co"
                              rules={[
                                { required: true, message: 'Vui long nhap mo ta su co' },
                                { min: 10, message: 'Mo ta can toi thieu 10 ky tu' },
                              ]}
                            >
                              <Input.TextArea rows={4} placeholder="Mo ta hien tuong loi, thoi diem phat hien, tinh trang hien tai..." />
                            </Form.Item>

                            <Form.Item
                              name="image"
                              label="Anh minh chung"
                              valuePropName="fileList"
                              getValueFromEvent={normUploadFile}
                            >
                              <Upload
                                accept="image/png,image/jpeg,image/webp"
                                beforeUpload={() => false}
                                maxCount={1}
                                listType="picture"
                              >
                                <Button icon={<UploadOutlined />}>Chon anh</Button>
                              </Upload>
                            </Form.Item>

                            <Button
                              danger
                              type="primary"
                              icon={<ToolOutlined />}
                              loading={reporting}
                              onClick={handleReportDamage}
                            >
                              Gui bao hong
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                    ) : null}

                    {result?.can_request_return ? (
                      <Col xs={24} xl={12}>
                        <Card size="small" title="Yeu cau tra thiet bi" bordered>
                          <Form form={returnForm} layout="vertical">
                            <Form.Item
                              name="return_reason"
                              label="Ghi chu tra thiet bi"
                            >
                              <Input.TextArea rows={4} placeholder="Tinh trang thiet bi khi tra, phu kien di kem, ghi chu neu co..." />
                            </Form.Item>

                            <Button
                              type="primary"
                              icon={<RollbackOutlined />}
                              loading={returning}
                              onClick={handleRequestReturn}
                            >
                              Gui yeu cau tra
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                    ) : null}
                  </Row>
                ) : null}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default HandoverConfirmationPage;
