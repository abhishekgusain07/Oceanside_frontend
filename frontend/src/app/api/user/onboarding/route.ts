import { NextResponse } from "next/server";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";

// Name of our dedicated onboarding cookie - same as in middleware
const ONBOARDING_COOKIE_NAME = "user-onboarding-completed";

export async function POST(request: Request) {
  try {
    // Get the current user's session
    const session = await auth.api.getSession({
        headers: await headers() 
    });
    
    if (!session?.user || !session.user.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the request body
    const data = await request.json();

    // Update the user in the database
    await db.update(user)
      .set({
        name: data.name || session.user.name,
        onboardingCompleted: true,
        // Other fields you want to update
      })
      .where(eq(user.id, session.user.id));

    // Create response with success message
    const response = NextResponse.json({
      success: true,
      message: "Onboarding completed successfully"
    });

    // Set our dedicated cookie for middleware to check
    // Include user ID in the cookie value to make it user-specific
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
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { success: false, message: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
} 