import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown, Empty, Spin, Tooltip, Typography, notification } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axiosInstance from '../utils/axiosInstance';

const { Text } = Typography;
const MAX_VISIBLE_NOTIFICATIONS = 10;

const levelClassMap = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

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
      notification.error({ title: 'Không thể tải thông báo' });
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
      notification.error({ title: 'Không thể cập nhật thông báo' });
    }
  };

  const markAsRead = async (item) => {
    if (!item?.id || item.read) return;

    setNotifications((items) => items.map((current) => (
      current.id === item.id ? { ...current, read: true } : current
    )));

    try {
      await axiosInstance.patch(`/notifications/${item.id}/read`);
    } catch {
      fetchNotifications();
      notification.error({ title: 'Không thể đánh dấu đã đọc' });
    }
  };

  const visibleNotifications = notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS);

  const dropdownContent = (
    <div className="notification-panel">
      <div className="notification-panel__header">
        <div>
          <Text strong>Thông báo</Text>
          <Text type="secondary" className="notification-panel__subtitle">
            {unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
          </Text>
        </div>
        <Button type="link" size="small" disabled={!unreadCount} onClick={markAllAsRead}>
          Đọc hết
        </Button>
      </div>

      <Spin spinning={loading}>
        {visibleNotifications.length ? (
          <div className="notification-panel__body">
            {visibleNotifications.map((item) => {
              const levelClass = levelClassMap[item.level] || 'info';
              const title = item.title || 'Thông báo';
              const message = item.message || '-';

              return (
                <Tooltip key={item.id} title={message} placement="left">
                  <button
                    type="button"
                    className={`notification-item${item.read ? '' : ' is-unread'}`}
                    onClick={() => markAsRead(item)}
                  >
                    <span className={`notification-item__dot notification-item__dot--${levelClass}`} />
                    <span className="notification-item__content">
                      <span className="notification-item__title">{title}</span>
                      <span className="notification-item__message">{message}</span>
                      <span className="notification-item__time">
                        {item.created_at ? dayjs(item.created_at).format('DD/MM/YYYY HH:mm') : ''}
                      </span>
                    </span>
                  </button>
                </Tooltip>
              );
            })}
            {notifications.length > MAX_VISIBLE_NOTIFICATIONS ? (
              <div className="notification-panel__footer">
                Hiển thị {MAX_VISIBLE_NOTIFICATIONS} thông báo gần nhất
              </div>
            ) : null}
          </div>
        ) : (
          <div className="notification-panel__empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
          </div>
        )}
      </Spin>
    </div>
  );

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => dropdownContent}
      placement="bottomRight"
      overlayStyle={{ zIndex: 1200 }}
    >
      <Badge count={unreadCount} size="small">
        <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Thông báo" />
      </Badge>
    </Dropdown>
  );
};

export default NotificationBell;
