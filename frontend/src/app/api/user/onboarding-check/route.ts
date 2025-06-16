import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Direct database check endpoint that bypasses all auth mechanisms
 * This is for debugging only
 */
export async function GET(request: Request) {
  try {
    // Get user ID from query params for testing
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({
        error: "No userId provided",
        success: false
      });
    }
    
    console.log(`Direct DB check for user ID: ${userId}`);
    
    // Directly query the database using proper Drizzle syntax
    const userData = await db
      .select({
        id: user.id,
        onboardingCompleted: user.onboardingCompleted
      })
      .from(user)
      .where(eq(user.id, userId));
    
    console.log(`Direct DB result:`, JSON.stringify(userData));
    
    return NextResponse.json({
      success: true,
      user: userData[0] || null,
      hasData: userData.length > 0,
      onboardingCompleted: userData[0]?.onboardingCompleted || false
    });
  } catch (error) {
    console.error("Error in direct DB check:", error);
    return NextResponse.json({
      error: String(error),
      success: false
    }, { status: 500 });
  }
} 