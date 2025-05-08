import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searches = await prisma.search.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return NextResponse.json(searches, { status: 200 });
  } catch (error) {
    console.error('Error fetching search history:', error);
    return NextResponse.json({ error: 'Failed to fetch search history' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query, type } = await req.json();
  if (!query || !type) {
    return NextResponse.json({ error: 'Query and type are required' }, { status: 400 });
  }

  try {
    const newSearch = await prisma.search.create({
      data: {
        query,
        type,
        userId: session.user.id,
      },
    });
    return NextResponse.json(newSearch, { status: 201 });
  } catch (error) {
    console.error('Error saving search:', error);
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      // Delete a single search entry
      const search = await prisma.search.findUnique({
        where: { id },
      });
      if (!search || search.userId !== session.user.id) {
        return NextResponse.json({ error: 'Search not found or unauthorized' }, { status: 404 });
      }
      await prisma.search.delete({
        where: { id },
      });
      return NextResponse.json({ message: 'Search deleted successfully' }, { status: 200 });
    } else {
      // Clear all search history for the user
      await prisma.search.deleteMany({
        where: { userId: session.user.id },
      });
      return NextResponse.json({ message: 'Search history cleared successfully' }, { status: 200 });
    }
  } catch (error) {
    console.error('Error deleting search history:', error);
    return NextResponse.json({ error: 'Failed to delete search history' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}