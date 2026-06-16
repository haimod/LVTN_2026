import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown, Empty, List, Space, Spin, Typography, notification } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../utils/axiosInstance';

const { Text } = Typography;

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/notifications');
      const data = response.data.data ? response.data.data : response.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      notification.error({ message: 'Khong the tai thong bao' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(fetchNotifications, 0);

    const interval = window.setInterval(fetchNotifications, 30000);
    window.addEventListener('notifications-updated', fetchNotifications);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener('notifications-updated', fetchNotifications);
    };
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const markAllAsRead = async () => {
    try {
      await axiosInstance.patch('/notifications/read-all');
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch {
      notification.error({ message: 'Khong the cap nhat thong bao' });
    }
  };

  const dropdownContent = (
    <div style={{ width: 360, maxWidth: 'calc(100vw - 32px)', padding: 12 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>Thong bao</Text>
        <Button type="link" size="small" disabled={!unreadCount} onClick={markAllAsRead}>
          Danh dau da doc
        </Button>
      </Space>

      <Spin spinning={loading}>
        {notifications.length ? (
          <List
            dataSource={notifications.slice(0, 8)}
            renderItem={(item) => (
              <List.Item style={{ padding: '10px 0' }}>
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      {!item.read ? <Badge status="processing" /> : <Badge status="default" />}
                      <span>{item.title || 'Thong bao'}</span>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{item.message || '-'}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.created_at ? dayjs(item.created_at).format('DD/MM/YYYY HH:mm') : ''}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chua co thong bao" />
        )}
      </Spin>
    </div>
  );

  return (
    <Dropdown trigger={['click']} dropdownRender={() => dropdownContent} placement="bottomRight">
      <Badge count={unreadCount} size="small">
        <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Thong bao" />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
