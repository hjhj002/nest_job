import request from '../utils/request';

export interface UserRole {
  id: string;
  code: string;
  name: string;
}

export interface UserItem {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  realName?: string;
  status: number;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface UserListResult {
  list: UserItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const userApi = {
  getList: (params: { page?: number; pageSize?: number; keyword?: string }) =>
    request.get<UserListResult>('/users', { params }),

  getRoles: () =>
    request.get<UserRole[]>('/users/roles'),

  create: (data: { username: string; password: string; realName?: string; email?: string; phone?: string; roleIds?: string[] }) =>
    request.post('/users', data),

  update: (id: string, data: { realName?: string; email?: string; phone?: string; status?: number }) =>
    request.put(`/users/${id}`, data),

  remove: (id: string) =>
    request.delete(`/users/${id}`),

  updateRoles: (id: string, roleIds: string[]) =>
    request.put(`/users/${id}/roles`, { roleIds }),
};
