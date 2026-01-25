import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
