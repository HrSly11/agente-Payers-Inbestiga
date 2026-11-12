import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas o cuenta inactiva.');
    }

    const passwordValida = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const payload = { sub: user.id, username: user.username, email: user.email, rol: user.rol };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        rol: user.rol,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, rol: true, fechaCreacion: true },
    });
    return user;
  }
}
