import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from '../auth.service';
import { UserResponseDto } from '../../users/dto';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private appConfig: AppConfig,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<UserResponseDto> {
    const user = await this.authService.validateUser(payload);

    if (!user) {
      throw new UnauthorizedException('Invalid token or user not found');
    }

    return user;
  }
}
