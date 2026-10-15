import request from '../utils/request';
import type { LoginParams, LoginResult, User } from '../types';

export const authApi = {
  // 登录
  login: (params: LoginParams) => {
    return request.post<LoginResult>('/auth/login', params);
  },

  // 获取当前用户信息
  getCurrentUser: () => {
    return request.get<User>('/auth/me');
  },

  // 登出
  logout: () => {
    return request.post('/auth/logout');
  },
};
