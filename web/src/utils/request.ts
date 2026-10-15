import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'antd';

// 创建axios实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response;
    if (data.code !== 200) {
      message.error(data.message || '请求失败');
      return Promise.reject(new Error(data.message));
    }
    return data.data;
  },
  (error) => {
    const { response } = error;
    if (response) {
      switch (response.status) {
        case 401:
          // On login page, don't redirect — show the actual error
          if (window.location.pathname === '/login') {
            const msg = response.data?.message || '用户名或密码错误';
            return Promise.reject(new Error(msg));
          }
          message.error('登录已过期，请重新登录');
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
        case 403:
          message.error('没有权限访问');
          break;
        case 404:
          message.error('请求的资源不存在');
          break;
        case 500:
          message.error('服务器内部错误');
          break;
        default:
          message.error(response.data?.message || '网络错误');
      }
    } else {
      message.error('网络连接失败');
    }
    return Promise.reject(error);
  }
);

export default request;

// 统一响应结构
export interface Result<T = any> {
  code: number;
  message: string;
  data: T;
}
