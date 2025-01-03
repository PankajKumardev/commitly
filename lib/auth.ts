import GithubProvider from 'next-auth/providers/github';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: (() => {
        if (!process.env.GITHUB_CLIENT_ID) {
          throw new Error('Missing GITHUB_CLIENT_ID environment variable');
        }
        return process.env.GITHUB_CLIENT_ID;
      })(),
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({
      user,
      account,
    }: {
      user: {
        email: string;
        name: string;
      };
      account: {
        provider: 'google' | 'github';
      };
    }) {
      console.log('hi signin');
      if (!user || !user.email) {
        return false;
      }

      try {
        await prisma.user.upsert({
          where: {
            email: user.email,
          },
          create: {
            email: user.email,
            name: user.name,
            auth_type: account.provider === 'github',
          },
          update: {
            name: user.name,
            auth_type: account.provider === 'github',
          },
        });
        return true;
      } catch (error) {
        console.error('Error during user upsert:', error);
        return false;
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'secret',
};
