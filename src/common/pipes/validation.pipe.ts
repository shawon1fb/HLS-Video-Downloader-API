import { ValidationPipe as NestValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export class CustomValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      // Transform incoming data to match DTO types
      transform: true,
      
      // Strip properties that don't have decorators
      whitelist: true,
      
      // Throw error if non-whitelisted properties are present
      forbidNonWhitelisted: true,
      
      // Disable detailed error messages in production
      disableErrorMessages: process.env.NODE_ENV === 'production',
      
      // Transform validation errors to a more secure format
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = this.formatErrors(errors);
        return new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          errors: messages,
        });
      },
    });
  }

  private formatErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];
    
    for (const error of errors) {
      if (error.constraints) {
        // Only include safe constraint messages
        const constraintMessages = Object.values(error.constraints)
          .filter(message => this.isSafeMessage(message))
          .map(message => `${error.property}: ${message}`);
        messages.push(...constraintMessages);
      }
      
      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const childMessages = this.formatErrors(error.children)
          .map(message => `${error.property}.${message}`);
        messages.push(...childMessages);
      }
    }
    
    return messages;
  }

  private isSafeMessage(message: string): boolean {
    // Filter out potentially sensitive information from error messages
    const unsafePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
    ];
    
    return !unsafePatterns.some(pattern => pattern.test(message));
  }
}