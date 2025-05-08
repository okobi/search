// src/app/auth/signup/actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';

export async function registerUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) return;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // You could return an error here and display it with server component state (future upgrade)
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  redirect('/auth/signin'); // Auto-redirect after successful signup
}
