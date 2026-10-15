import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { Permissions } from './decorators/permissions.decorator';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  @Permissions('user:read')
  list(@Query() query: any) {
    return this.userService.list(query);
  }

  @Get('roles')
  @Permissions('role:read')
  getRoles() {
    return this.userService.getRoles();
  }

  @Get(':id')
  @Permissions('user:read')
  getById(@Param('id') id: string) {
    return this.userService.getById(id);
  }

  @Post()
  @Permissions('user:create')
  create(@Body() dto: any) {
    return this.userService.create(dto);
  }

  @Put(':id')
  @Permissions('user:update')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('user:delete')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Put(':id/roles')
  @Permissions('role:manage')
  updateRoles(@Param('id') id: string, @Body() body: { roleIds: string[] }) {
    return this.userService.updateRoles(id, body.roleIds);
  }
}
