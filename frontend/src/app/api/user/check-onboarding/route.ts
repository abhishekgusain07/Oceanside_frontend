import { NextRequest, NextResponse } from "next/server";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { headers } from "next/headers";

// Name of our dedicated onboarding cookie - same as in middleware
const ONBOARDING_COOKIE_NAME = "user-onboarding-completed";

/**
 * This API route is called by middleware to check if a user has completed onboarding
 * when we can't reliably determine it from cookies alone. It checks the database
 * and redirects appropriately.
 */
export async function GET(request: NextRequest) {
  try {
    // Get redirect destination from query params
    const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    
    // Check if we're checking for already completed onboarding
    const checkingForCompleted = request.nextUrl.searchParams.get('checking_for_completed') === 'true';
    
    // Get the current user's session
    const session = await auth.api.getSession({
      headers: await headers()
    });
    
    if (!session?.user?.id) {
      // Not logged in, redirect to login
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
    
    // Check the database for onboarding status
    const userData = await db.select({
      onboardingCompleted: user.onboardingCompleted
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .execute();
    
    const hasCompletedOnboarding = userData[0]?.onboardingCompleted || false;
    
    // Handle based on whether we're checking for completion or not
    if (checkingForCompleted) {
      if (hasCompletedOnboarding) {
        // User already completed onboarding, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } else {
        // User hasn't completed onboarding, allow them to continue to onboarding page
        // Add the checking_onboarding flag to prevent middleware from redirecting again
        const onboardingUrl = new URL('/onboarding', request.url);
        onboardingUrl.searchParams.set('checking_onboarding', 'true');
        return NextResponse.redirect(onboardingUrl);
      }
    } else {
      // Regular check for non-onboarding pages
      if (hasCompletedOnboarding) {
        // User has completed onboarding, set the cookie and redirect to their destination
        const response = NextResponse.redirect(new URL(redirectPath, request.url));
        
        // Set the cookie for future middleware checks
        const cookieValue = JSON.stringify({
          userId: session.user.id,
          completed: true
        });
        
        response.cookies.set({
          name: ONBOARDING_COOKIE_NAME,
          value: cookieValue,
          path: "/",
          maxAge: 60 * 60 * 24 * 365, // 1 year in seconds
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax"
        });
        
        return response;
      } else {
        // User hasn't completed onboarding, redirect to onboarding
        // Add the checking_onboarding flag to prevent middleware from redirecting again
        const onboardingUrl = new URL('/onboarding', request.url);
        onboardingUrl.searchParams.set('checking_onboarding', 'true');
        return NextResponse.redirect(onboardingUrl);
      }
    }
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    // On error, redirect to a safe page
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
} 