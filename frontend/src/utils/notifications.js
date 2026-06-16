const STORAGE_KEY = 'asset_notifications';

export const readNotifications = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveNotifications = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('notifications-updated'));
};

export const pushLocalNotification = ({ title, message, type = 'info' }) => {
  const items = readNotifications();
  saveNotifications([
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      message,
      type,
      read: false,
      created_at: new Date().toISOString(),
    },
    ...items,
  ]);
};
