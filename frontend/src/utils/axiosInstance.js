import axios from "axios"

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '');

const axiosInstance = axios.create({
    baseURL: apiBaseUrl,
    headers:{
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

//request Interceptor: tự động kẹp token vào mỗi lần gọi API
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if(token){
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error)=> Promise.reject(error)
);


// Response Interceptor: Xử lý nếu Token hết hạn hoặc lỗi xác thực (401)
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // === ĐÂY LÀ ĐIỀU KIỆN CHÚNG TA CẦN THÊM VÀO ===
            // Chỉ đá về trang đăng nhập nếu người dùng KHÔNG PHẢI đang ở trang /login
            if (window.location.pathname !== '/login') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                window.location.href = '/login'; 
            }
        }
        return Promise.reject(error); // Vẫn phải ném lỗi đi tiếp để catch ở file Login.jsx bắt được
    }
);

export default axiosInstance;
