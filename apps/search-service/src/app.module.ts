import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SearchController } from "./controllers/search.controller";
import { ElasticsearchService } from "./services/elasticsearch.service";
import { RedisCacheService } from "./services/redis-cache.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" })],
  controllers: [SearchController],
  providers: [ElasticsearchService, RedisCacheService],
})
export class AppModule {}
