import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest } from 'next/server';

const isPublic = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/setup(.*)']);

const clerk = clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    await auth.protect();
  }
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  return clerk(req, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
