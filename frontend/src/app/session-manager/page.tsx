"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, RefreshCw, Users, Settings, AlertTriangle, LogIn, User as UserIcon } from 'lucide-react';
import { SessionAPI } from '@/lib/api';
import { SessionDetailResponse } from '@/lib/types';
import { useUser } from '@/hooks/useUser';

export default function SessionManagerPage() {
  const { user, isLoading: userLoading, isAuthenticated } = useUser();
  const [sessions, setSessions] = useState<SessionDetailResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(7);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Auto-load sessions when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserSessions();
    }
  }, [isAuthenticated, user?.id]);

  const loadUserSessions = async () => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      const userSessions = await SessionAPI.getUserSessions(user.id);
      setSessions(userSessions);
      toast.success(`Loaded ${userSessions.length} sessions`);
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      toast.error(error.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    try {
      await SessionAPI.deleteSession(sessionId, user.id);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      toast.success('Session deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      toast.error(error.message || 'Failed to delete session');
    }
  };

  const cleanupOldSessions = async () => {
    try {
      setIsCleaningUp(true);
      const result = await SessionAPI.cleanupOldSessions(cleanupDays);
      toast.success(`Cleaned up ${result.sessions_cleaned} old sessions`);
      
      // Reload sessions after cleanup
      if (isAuthenticated && user?.id) {
        await loadUserSessions();
      }
    } catch (error: any) {
      console.error('Failed to cleanup sessions:', error);
      toast.error(error.message || 'Failed to cleanup sessions');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'created': 'bg-blue-100 text-blue-800',
      'active': 'bg-green-100 text-green-800',
      'ended': 'bg-gray-100 text-gray-800',
    };
    
    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Show loading state while checking authentication
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show authentication required message
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-16">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <LogIn className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>
                You need to be logged in to manage your sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Please log in to view and manage your recording sessions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Session Manager</h1>
          <p className="text-gray-600">Manage your recording sessions and cleanup old ones</p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Current User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Logged in as:</p>
                <p className="font-medium">{user?.email || user?.id}</p>
              </div>
              <Button onClick={loadUserSessions} disabled={isLoading} variant="outline">
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh Sessions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cleanup Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cleanup Old Sessions
            </CardTitle>
            <CardDescription>
              Automatically cleanup old sessions that are still active/created
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="cleanupDays">Days Old</Label>
                <Input
                  id="cleanupDays"
                  type="number"
                  min="1"
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(parseInt(e.target.value) || 7)}
                />
              </div>
              <Button 
                onClick={cleanupOldSessions} 
                disabled={isCleaningUp}
                variant="destructive"
              >
                {isCleaningUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Cleanup
              </Button>
            </div>
            {sessions.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-700">
                  <strong>Preview:</strong> Sessions older than {cleanupDays} days will be cleaned up
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions Stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{sessions.length}</div>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {sessions.filter(s => s.status === 'created' || s.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">Active Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">
                  {sessions.filter(s => {
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
                    return new Date(s.created_at) < cutoffDate && (s.status === 'created' || s.status === 'active');
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Old Active Sessions</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sessions List */}
        {sessions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Sessions</CardTitle>
              <CardDescription>
                Manage your recording sessions (you can only delete sessions you created)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.session_id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{session.title}</h3>
                          {getStatusBadge(session.status)}
                        </div>
                        
                        {session.description && (
                          <p className="text-gray-600 text-sm mb-2">{session.description}</p>
                        )}
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <div>{formatDate(session.created_at)}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Participants:</span>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {session.participant_count}/{session.max_participants}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <div className="capitalize">{session.status}</div>
                          </div>
                        </div>
                      </div>
                      
                      {session.host_user_id === user?.id && session.status !== 'ended' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSession(session.session_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {sessions.length === 0 && !isLoading && (
          <Card>
            <CardContent className="text-center py-12">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h3>
              <p className="text-gray-600 mb-4">
                You haven't created any recording sessions yet.
              </p>
              <Button onClick={() => window.location.href = '/createsession'}>
                Create Your First Session
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 