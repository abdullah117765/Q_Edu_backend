import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { BillingService } from './billing.service';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';
import { CreateSubscriptionPlanDto, StartCheckoutDto, UpdateSubscriptionPlanDto } from './dto/subscription.dto';

type RequestWithUser = Request & { user?: { id?: string; role?: Role } };

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ---------- Public catalog (any authenticated user) ----------

  @Get('packages')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'List active credit packages' })
  listPackages() {
    return this.billing.listPackages({ activeOnly: true });
  }

  @Get('plans')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List active subscription plans (academies)' })
  listPlans() {
    return this.billing.listPlans({ activeOnly: true });
  }

  // ---------- Self-service ----------

  @Get('me')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'My current billing overview (balance, subscription, recent payments)' })
  myOverview(@Req() req: RequestWithUser) {
    return this.billing.getMyBillingOverview(req.user!.id as string);
  }

  @Post('checkout/package')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Auth(Role.ACADEMY_OWNER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a Stripe Checkout session to buy a credit package' })
  startPackageCheckout(@Req() req: RequestWithUser, @Body() dto: StartCheckoutDto) {
    return this.billing.startPackageCheckout(req.user!.id as string, dto);
  }

  @Post('checkout/plan')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Auth(Role.ACADEMY_OWNER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a Stripe Checkout session to subscribe to a plan' })
  startPlanCheckout(@Req() req: RequestWithUser, @Body() dto: StartCheckoutDto) {
    return this.billing.startPlanCheckout(req.user!.id as string, dto);
  }

  @Post('portal')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Auth(Role.ACADEMY_OWNER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Open the Stripe customer billing portal' })
  openPortal(@Req() req: RequestWithUser, @Query('returnUrl') returnUrl?: string) {
    return this.billing.openBillingPortal(req.user!.id as string, returnUrl);
  }

  @Post('subscription/cancel')
  @Auth(Role.ACADEMY_OWNER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel the current active subscription at period end' })
  cancelSubscription(@Req() req: RequestWithUser) {
    return this.billing.cancelMySubscription(req.user!.id as string);
  }

  // ---------- Admin (super admin only) ----------

  @Get('admin/analytics')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform billing analytics for super admin' })
  adminAnalytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.billing.getAdminAnalytics({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('admin/packages')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a credit package' })
  createPackage(@Body() dto: CreatePackageDto) {
    return this.billing.createPackage(dto);
  }

  @Patch('admin/packages/:id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a credit package' })
  updatePackage(@Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.billing.updatePackage(id, dto);
  }

  @Delete('admin/packages/:id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a credit package' })
  deletePackage(@Param('id') id: string) {
    return this.billing.deletePackage(id);
  }

  @Post('admin/plans')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a subscription plan' })
  createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.billing.createPlan(dto);
  }

  @Patch('admin/plans/:id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a subscription plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.billing.updatePlan(id, dto);
  }

  @Delete('admin/plans/:id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a subscription plan' })
  deletePlan(@Param('id') id: string) {
    return this.billing.deletePlan(id);
  }
}
