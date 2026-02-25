import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty, IsOptional } from 'class-validator';

@Configuration()
export class SwaggerConfig {
  @IsNotEmpty()
  @Value('SWAGGER_TITLE', { default: 'Backend template API' })
  title: string;

  @IsNotEmpty()
  @Value('SWAGGER_DESCRIPTION', { default: 'A comprehensive NestJS-based backend application for sports administration' })
  description: string;

  @IsNotEmpty()
  @Value('SWAGGER_VERSION', { default: '1.0.0' })
  version: string;

  @IsOptional()
  @Value('SWAGGER_CONTACT_NAME', { default: 'Backend template Team' })
  contactName: string;

  @IsOptional()
  @Value('SWAGGER_CONTACT_EMAIL', { default: 'admin@sportsadmin.com' })
  contactEmail: string;

  @IsNotEmpty()
  @Value('SWAGGER_PATH', { default: '/api/docs' })
  path: string;

  @IsNotEmpty()
  @Value('SWAGGER_ENABLED', { default: true })
  enabled: boolean;

  @IsOptional()
  @Value('SWAGGER_SERVERS')
  servers?: string;

  getServers() {
    if (!this.servers) {
      return [
        {
          url: 'http://localhost:8000',
          description: 'Development server'
        },
        {
          url: 'https://api.sportsadmin.com',
          description: 'Production server'
        }
      ];
    }
    return JSON.parse(this.servers);
  }

  getSwaggerOptions() {
    return {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: this.title,
          description: this.description,
          version: this.version,
          contact: {
            name: this.contactName,
            email: this.contactEmail
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: this.getServers(),
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT Authorization header using the Bearer scheme. Format: Bearer <token>'
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
              description: 'API Key for application authentication. Can also be provided as Bearer token in Authorization header.'
            }
          },
          schemas: {
            JwtPayload: {
              type: 'object',
              properties: {
                sub: {
                  type: 'string',
                  description: 'User ID (subject)'
                },
                email: {
                  type: 'string',
                  description: 'User email address'
                },
                username: {
                  type: 'string',
                  description: 'Username'
                },
                role: {
                  type: 'string',
                  enum: ['user', 'admin', 'moderator'],
                  description: 'User role'
                },
                iat: {
                  type: 'number',
                  description: 'Issued at timestamp'
                },
                exp: {
                   type: 'number',
                   description: 'Expiration timestamp'
                 }
               }
             },
             AuthenticationError: {
              type: 'object',
              properties: {
                statusCode: {
                  type: 'number',
                  example: 401
                },
                message: {
                  type: 'string',
                  example: 'Unauthorized'
                },
                error: {
                  type: 'string',
                  example: 'Unauthorized'
                }
              }
            },
            ForbiddenError: {
              type: 'object',
              properties: {
                statusCode: {
                  type: 'number',
                  example: 403
                },
                message: {
                  type: 'string',
                  example: 'Forbidden'
                },
                error: {
                  type: 'string',
                  example: 'Forbidden'
                }
              }
            },
            RateLimitError: {
              type: 'object',
              properties: {
                statusCode: {
                  type: 'number',
                  example: 429
                },
                message: {
                  type: 'string',
                  example: 'Too Many Requests'
                },
                error: {
                  type: 'string',
                  example: 'Too Many Requests'
                }
              }
            }
          }
         },
        security: [
          {
            bearerAuth: []
          },
          {
            apiKeyAuth: []
          }
        ],
        tags: [
          {
            name: 'Authentication',
            description: 'Authentication and authorization endpoints. Includes user registration, login, token refresh, password reset, and logout functionality.'
          },
          {
            name: 'Applications',
            description: 'Application management endpoints (Admin only). Manage applications, API keys, and application configurations. Requires admin role and JWT authentication.'
          },
          {
            name: 'Public API',
            description: 'Public API endpoints for applications. These endpoints use API key authentication and are rate-limited. Used by external applications to access their data.'
          },
          {
            name: 'Users',
            description: 'User management endpoints. Includes user CRUD operations, profile management, role management, and account activation. Most endpoints require authentication and appropriate permissions.'
          },
          {
            name: 'Health',
            description: 'Health check and monitoring endpoints. Public endpoints for system status monitoring.'
          }
        ],
        'x-authentication-info': {
          description: 'This API uses two types of authentication:',
          schemes: {
            'JWT Bearer Token': {
              description: 'Used for user authentication. Obtained through login endpoint.',
              format: 'Authorization: Bearer <jwt_token>',
              endpoints: 'Most user-facing endpoints',
              roles: ['user', 'admin', 'moderator'],
              'rate-limits': {
                default: '100 requests per minute',
                strict: '20 requests per minute (for sensitive operations)'
              }
            },
            'API Key': {
              description: 'Used for application-to-application communication.',
              format: 'x-api-key: <api_key> OR Authorization: Bearer <api_key>',
              endpoints: 'Public API endpoints (/api/v1/application/*)',
              'rate-limits': {
                default: '100 requests per minute',
                strict: '20 requests per minute (for validation endpoints)'
              }
            }
          },
          'role-based-access': {
            user: 'Basic user permissions - can access own profile and public endpoints',
            moderator: 'Extended permissions - can moderate content and access additional endpoints',
            admin: 'Full permissions - can manage users, applications, and system configuration'
          }
        }
      }
    };
  }

  getSwaggerUIOptions() {
    return {
      routePrefix: this.path,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          next();
        },
        preHandler: function (request, reply, next) {
          next();
        }
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
      },
      transformSpecificationClone: true
    };
  }
}