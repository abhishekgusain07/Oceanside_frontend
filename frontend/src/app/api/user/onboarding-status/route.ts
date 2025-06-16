import { NextResponse } from "next/server";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";

/**
 * Simple API endpoint to check onboarding status.
 * Returns JSON with onboardingCompleted status.
 * No redirects, just data.
 */
export async function GET() {
  try {
    // Get the current user's session
    const session = await auth.api.getSession({
      headers: await headers()
    });
    
    if (!session?.user?.id) {
      // Not authenticated
      return NextResponse.json({ 
        authenticated: false,
        onboardingCompleted: false 
      });
    }
    
    // Check the database for onboarding status
    const userData = await db.select({
      onboardingCompleted: user.onboardingCompleted
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .execute();
    
    const hasCompletedOnboarding = userData[0]?.onboardingCompleted || false;
    
    // Return just the status as JSON
    return NextResponse.json({
      authenticated: true,
      onboardingCompleted: hasCompletedOnboarding
    });
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json(
      { 
        authenticated: false,
        onboardingCompleted: false,
        error: "Failed to check onboarding status" 
      },
      { status: 500 }
    );
  }
} 