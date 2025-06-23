"use client";

// TODO: Update this page to use the new Recording API instead of SessionAPI
// This page is temporarily disabled during the architecture migration

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SessionManagerPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto pt-16">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Session Manager - Architecture Migration</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              The Session Manager is temporarily unavailable while we migrate to the new Socket.IO + Celery architecture.
            </p>
            <p className="text-sm text-gray-500">
              The new Recording Manager will be available soon with improved performance and reliability.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* 
// OLD IMPLEMENTATION - COMMENTED OUT DURING MIGRATION
// ... entire original implementation commented out
*/ 