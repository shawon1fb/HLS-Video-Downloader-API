import { Module, OnModuleInit, Inject, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { createKeyv } from '@keyv/redis';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { createKeyv as createKeyvMemory } from 'cacheable';
import { ConfigifyModule } from '@itgorillaz/configify';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardConfigModule } from './bull-board/bull-board.module';
import { Cache } from 'cache-manager';
import { BullMQRedisConfig } from './config/bull.config';
import { RedisConfig } from './config/redis.config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SanitizationMiddleware, SecurityHeadersMiddleware } from './common/middleware';

@Module({
  imports: [
    ConfigifyModule.forRootAsync(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigifyModule],
      useFactory: async (redisConfig: RedisConfig) => {
        console.log('🔧 === CACHE FACTORY DEBUGGING START ===');
        console.log('🔧 Redis Configuration (raw):', {
          host: redisConfig.host,
          port: redisConfig.port,
          ttl: redisConfig.ttl,
          hasPassword: !!redisConfig.password,
          passwordLength: redisConfig.password?.length || 0,
        });

        console.log('🔧 Redis Configuration (types):', {
          hostType: typeof redisConfig.host,
          portType: typeof redisConfig.port,
          ttlType: typeof redisConfig.ttl,
          passwordType: typeof redisConfig.password,
        });

        // Ensure proper type conversion
        const normalizedConfig = {
          host: redisConfig.host,
          port: Number(redisConfig.port),
          ttl: Number(redisConfig.ttl),
          password: redisConfig.password,
        };

        console.log('🔧 Normalized Configuration:', {
          host: normalizedConfig.host,
          port: normalizedConfig.port,
          ttl: normalizedConfig.ttl,
          hasPassword: !!normalizedConfig.password,
          portIsNumber: typeof normalizedConfig.port === 'number',
          ttlIsNumber: typeof normalizedConfig.ttl === 'number',
        });

        // Validate configuration
        if (
          !normalizedConfig.host ||
          !normalizedConfig.port ||
          isNaN(normalizedConfig.port)
        ) {
          console.error(
            '❌ Invalid Redis configuration - missing host or invalid port',
          );
          console.log(
            '🔄 Falling back to memory-only cache due to invalid config',
          );

          const memoryStore = createKeyvMemory({
            ttl: normalizedConfig.ttl || 3600000,
            lruSize: 5000,
          });

          console.log('🏪 Created memory-only store:', {
            type: memoryStore.constructor.name,
            ttl: normalizedConfig.ttl || 3600000,
          });

          return { stores: [memoryStore] };
        }

        // Build Redis connection URL with authentication
        const redisUrl = normalizedConfig.password
          ? `redis://:${normalizedConfig.password}@${normalizedConfig.host}:${normalizedConfig.port}`
          : `redis://${normalizedConfig.host}:${normalizedConfig.port}`;

        console.log(
          '🔗 Attempting Redis connection to:',
          `redis://${normalizedConfig.host}:${normalizedConfig.port}`,
        );
        console.log(
          '🔗 Full Redis URL (masked):',
          redisUrl.replace(/:([^:@]+)@/, ':***@'),
        );

        try {
          // Create Redis store with connection testing
          const redisStore = createKeyv(redisUrl, {
            namespace: 'app-cache',
          });

          console.log('🔧 Created Redis store:', {
            type: redisStore.constructor.name,
            namespace: 'app-cache',
          });

          // Test Redis connection with timeout
          console.log('🧪 Testing Redis connection...');
          const connectionTestKey = `connection-test-${Date.now()}`;
          let testResult = null;

          try {
            // Use a simple ping-like test instead of set/get which might hang
            const testPromise = (async () => {
              await redisStore.set(connectionTestKey, 'success', 5000);
              const result = await redisStore.get(connectionTestKey);
              await redisStore.delete(connectionTestKey);
              return result;
            })();

            testResult = await Promise.race([
              testPromise,
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error('Redis connection timeout after 1 second'),
                    ),
                  1000,
                ),
              ),
            ]);

            console.log(
              '🧪 Redis connection test completed, result:',
              testResult,
            );
          } catch (error) {
            console.log('❌ Redis connection test failed:', error.message);
            console.log(
              '⚠️  Note: Cache may still work through fallback mechanisms',
            );
          }

          if (testResult === 'success') {
            console.log('✅ Redis connection test PASSED!');
            await redisStore.delete(connectionTestKey);

            // Create memory store as secondary
            const memoryStore = createKeyvMemory({
              ttl: normalizedConfig.ttl,
              lruSize: 5000,
            });

            console.log('🏪 Cache stores configuration:', {
              primary: 'Redis',
              secondary: 'Memory',
              redisNamespace: 'app-cache',
              memoryTTL: normalizedConfig.ttl,
              memoryLRUSize: 5000,
            });
            console.log('🔧 === CACHE FACTORY DEBUGGING END (SUCCESS) ===');

            return {
              stores: [redisStore, memoryStore],
            };
          } else {
            throw new Error(
              'Redis connection test failed - unexpected result: ' + testResult,
            );
          }
        } catch (error) {
          console.error('❌ Redis connection FAILED:', {
            message: error.message,
            code: error.code,
            errno: error.errno,
            syscall: error.syscall,
            address: error.address,
            port: error.port,
          });
          console.log('🔄 Falling back to memory-only cache');

          // Fallback to memory-only cache if Redis fails
          const memoryStore = createKeyvMemory({
            ttl: normalizedConfig.ttl,
            lruSize: 5000,
          });

          console.log('🏪 Created fallback memory store:', {
            type: memoryStore.constructor.name,
            ttl: normalizedConfig.ttl,
            lruSize: 5000,
          });

          console.log('🔧 === CACHE FACTORY DEBUGGING END (FALLBACK) ===');
          return { stores: [memoryStore] };
        }
      },
      inject: [RedisConfig], // This is the key line - inject the config
    }),
    BullModule.forRootAsync({
      imports: [ConfigifyModule],
      useFactory: async (bullmqRedisConfig: BullMQRedisConfig) => {
        console.log('🔧 BullMQ Redis Configuration:', {
          host: bullmqRedisConfig.host,
          port: bullmqRedisConfig.port,
          hasPassword: !!bullmqRedisConfig.password,
        });

        return {
          connection: {
            host: bullmqRedisConfig.host,
            port: bullmqRedisConfig.port,
            password: bullmqRedisConfig.password || undefined,
          },
        };
      },
      inject: [BullMQRedisConfig],
    }),
    BullBoardConfigModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit, NestModule {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}
  // onModuleInit() {

  // }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, SanitizationMiddleware)
      .forRoutes('*');
  }

  async onModuleInit() {
    console.log('🔍 === CACHE DEBUGGING START ===');

    // Debug cache manager structure
    console.log('📊 Cache Manager Type:', this.cacheManager.constructor.name);
    console.log('📊 Cache Manager Keys:', Object.keys(this.cacheManager));

    // Check if cache manager has stores property (multi-store setup)
    if ('stores' in this.cacheManager) {
      const stores = (this.cacheManager as any).stores;
      console.log('🏪 Number of stores configured:', stores?.length || 0);

      if (stores && Array.isArray(stores)) {
        stores.forEach((store: any, index: number) => {
          console.log(`🏪 Store ${index + 1}:`, {
            type: store.constructor.name,
            namespace: store.namespace || 'none',
            isRedis:
              store.constructor.name.includes('Redis') ||
              store.constructor.name.includes('Keyv'),
            hasConnection: !!store.redis || !!store.client,
          });
        });
      }
    }

    // Test cache operations with detailed logging
    console.log('🧪 Testing cache operations...');

    try {
      // Clear existing cache
      await this.cacheManager.clear();
      console.log('🧹 Cache cleared successfully');

      // Test basic set/get operations
      const testKey = 'debug-test-' + Date.now();
      const testValue = {
        timestamp: new Date().toISOString(),
        data: 'test-data',
      };

      console.log(`📝 Setting test key: ${testKey}`);
      await this.cacheManager.set(testKey, testValue, 60000); // 1 minute TTL

      console.log(`📖 Getting test key: ${testKey}`);
      const retrievedValue = await this.cacheManager.get(testKey);

      console.log('✅ Cache operation result:', {
        stored: testValue,
        retrieved: retrievedValue,
        matches: JSON.stringify(testValue) === JSON.stringify(retrievedValue),
      });

      // Test multiple keys to see consistency
      const multiTestKeys = ['test1', 'test2', 'test3', 'test4'];
      for (const key of multiTestKeys) {
        await this.cacheManager.set(key, `value-${key}-${Date.now()}`, 3600000);
        const value = await this.cacheManager.get(key);
        console.log(`🔑 Multi-test ${key}:`, { set: true, retrieved: !!value });
      }
    } catch (error) {
      console.error('❌ Cache operation failed:', error.message);
      console.error('❌ Error details:', error);
    }

    console.log('🔍 === CACHE DEBUGGING END ===');
  }
}
