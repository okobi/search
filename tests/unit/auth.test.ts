import { authOptions } from '../../src/app/api/auth/[...nextauth]/route';
import { registerUser } from '../../src/app/auth/signup/actions';
import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { mocked } from 'jest-mock';
import type { CredentialsConfig } from 'next-auth/providers/credentials';
import type { AdapterUser } from 'next-auth/adapters';
import type { RequestInternal } from 'next-auth';
import { Prisma } from '@prisma/client';

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockPrisma = mocked(prisma, { shallow: true }); // Shallow mock the module instance

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
const mockBcrypt = mocked(bcrypt);

describe('Authentication', () => {
  // Store original process.env
  const originalEnv = { ...process.env };

  // Define mock user matching Prisma User schema
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    emailVerified: null,
    name: 'Test User',
    password: 'hashed-password',
    image: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    searches: [],
    views: [],
    accounts: [],
    sessions: [],
  };

  // Mock request object for authorize
  const mockReq: Pick<RequestInternal, 'body' | 'query' | 'headers' | 'method'> = {
    body: {},
    query: {},
    headers: {},
    method: 'POST',
  };

  beforeEach(() => {
    // Clear mocks
    (mockPrisma.user.findUnique as jest.Mock).mockClear();
    (mockPrisma.user.create as jest.Mock).mockClear();
    mockBcrypt.compare.mockReset();
    mockBcrypt.hash.mockReset();

    // Mock bcrypt methods
    mockBcrypt.compare.mockImplementation((password: string, hash: string) =>
      Promise.resolve(password === 'password' && hash === 'hashed-password')
    );
    mockBcrypt.hash.mockImplementation((password: string, salt: string | number) =>
      Promise.resolve('hashed-password')
    );

    // Mock environment variables
    process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'mock-google-client-secret';

    // Spy on prisma.user.findUnique to ensure it’s called
    jest.spyOn(mockPrisma.user, 'findUnique').mockImplementation((args) => {
      const mockPrismaClient = {
        then: (resolve: any) => resolve(args.where.email === 'test@example.com' ? mockUser : null),
      };
      return mockPrismaClient as unknown as Prisma.Prisma__UserClient<typeof mockUser>;
    });
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };
    jest.restoreAllMocks(); // Restore mocks after each test
  });

  describe('Credentials Provider', () => {
    let credentialsProvider: CredentialsConfig;

    beforeEach(() => {
      credentialsProvider = authOptions.providers.find(
        (p) => p.id === 'credentials'
      ) as CredentialsConfig;

      // Mock authorize to handle errors
      credentialsProvider.authorize = jest.fn().mockImplementation(async (credentials, req) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await mockPrisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.password) {
          throw new Error('Invalid email or password');
        }

        const isPasswordValid = await mockBcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      });
    });

    it('authorizes user with valid credentials', async () => {
      const result = await credentialsProvider.authorize(
        {
          email: 'test@example.com',
          password: 'password',
        },
        mockReq
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password');
      expect(result).toEqual({
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('throws error for missing credentials', async () => {
      await expect(
        credentialsProvider.authorize(
          {
            email: '',
            password: '',
          },
          mockReq
        )
      ).rejects.toThrow('Email and password are required');

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws error for invalid email', async () => {
      await expect(
        credentialsProvider.authorize(
          {
            email: 'invalid@example.com',
            password: 'password',
          },
          mockReq
        )
      ).rejects.toThrow('Invalid email or password');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'invalid@example.com' },
      });
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws error for invalid password', async () => {
      await expect(
        credentialsProvider.authorize(
          {
            email: 'test@example.com',
            password: 'wrong-password',
          },
          mockReq
        )
      ).rejects.toThrow('Invalid email or password');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
    });
  });

  describe('Google Provider - SignIn Callback', () => {
    it('allows sign-in with Google provider', async () => {
      const user: AdapterUser = {
        id: '1',
        email: 'test@gmail.com',
        name: 'Google User',
        emailVerified: null,
      };
      const account = {
        provider: 'google',
        providerAccountId: 'google-123',
        type: 'oauth' as const,
        access_token: 'mock-access-token',
      };
      const profile = { email: 'test@gmail.com' };

      const result = await authOptions.callbacks!.signIn!({ user, account, profile });

      expect(result).toBe(true);
    });
  });

  describe('JWT and Session Callbacks', () => {
    it('adds user id and access token to JWT', async () => {
      const token = { sub: '1' };
      const user: AdapterUser = { id: '1', email: 'test@example.com', emailVerified: null };
      const account = {
        provider: 'google',
        providerAccountId: 'google-123',
        type: 'oauth' as const,
        access_token: 'mock-access-token',
      };

      const result = await authOptions.callbacks!.jwt!({ token, user, account });

      expect(result).toEqual({
        sub: '1',
        id: '1',
        accessToken: 'mock-access-token',
      });
    });

    it('adds user id and access token to session', async () => {
      const session = {
        user: { email: 'test@example.com' },
        expires: new Date('2025-02-01T00:00:00Z').toISOString(),
        sessionToken: 'mock-session-token',
        userId: '1',
      };
      const token = { id: '1', accessToken: 'mock-access-token' };
      const user: AdapterUser = { id: '1', email: 'test@example.com', emailVerified: null };

      const result = await authOptions.callbacks!.session!({
        session,
        token,
        user,
        newSession: null,
        trigger: 'update' as const,
      });

      expect(result).toEqual({
        user: { email: 'test@example.com', id: '1' },
        expires: expect.any(String),
        sessionToken: 'mock-session-token',
        userId: '1',
        accessToken: 'mock-access-token',
      });
    });
  });

  describe('registerUser', () => {
    it('registers a new user successfully', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('email', 'test@example.com');
      formData.append('password', 'password');

      const result = await registerUser(formData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password', 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashed-password',
        },
      });
      expect(result).toEqual({
        success: true,
        user: mockUser,
      });
    });

    it('throws error for missing fields', async () => {
      const formData = new FormData();
      formData.append('email', 'test@example.com');
      // Missing name and password

      await expect(registerUser(formData)).rejects.toThrow('All fields are required');

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws error for existing user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockReturnValue(Promise.resolve(mockUser));

      const formData = new FormData();
      formData.append('name', 'Test User');
      formData.append('email', 'test@example.com');
      formData.append('password', 'password');

      await expect(registerUser(formData)).rejects.toThrow('User already exists');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });
});