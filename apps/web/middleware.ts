import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

const isPublic = createRouteMatcher(['/sign-in(.*)']);

const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] || !process.env['CLERK_SECRET_KEY']) {
    return NextResponse.next();
  }
  return clerk(req, event);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
