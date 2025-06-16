"use server"

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getUserOnboardingStatus(userId: string) {
    const userOnboardingStatus = await db
        .select({ onboardingCompleted: user.onboardingCompleted })
        .from(user)
        .where(eq(user.id, userId))
        .execute()
        .then(results => results[0]);   

    return userOnboardingStatus;
}