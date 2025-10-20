import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaginatedPaymentsResponseDto } from './dto/paginated-payments-response.dto';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

type RequestWithUserRole = Request & { user?: { id?: string; role?: Role } };

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'List payment history with filters' })
  @ApiOkResponse({ type: PaginatedPaymentsResponseDto })
  async findAll(@Req() request: Request, @Query() query: PaymentsQueryDto): Promise<PaginatedPaymentsResponseDto> {
    const req = request as RequestWithUserRole;
    const userId = req.user?.id as string;
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    return this.paymentsService.findAll(query, userId, isSuperAdmin);
  }

  @Post()
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a manual payment entry' })
  @ApiOkResponse({ type: PaymentEntity })
  create(@Body() dto: CreatePaymentDto): Promise<PaymentEntity> {
    return this.paymentsService.create(dto);
  }
}
