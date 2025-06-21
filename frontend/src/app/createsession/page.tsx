"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { SessionAPI } from '@/lib/api';
import { SessionCreateRequest, SessionCreateResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Users, Clock, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';

interface CreateSessionForm {
  title: string;
  description: string;
  maxParticipants: number;
}

export default function CreateSessionPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<SessionCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateSessionForm>({
    defaultValues: {
      title: '',
      description: '',
      maxParticipants: 4,
    },
  });

  const onSubmit = async (data: CreateSessionForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionData: SessionCreateRequest = {
        user_id: user?.id!,
        title: data.title,
        description: data.description || undefined,
        max_participants: data.maxParticipants,
      };

      const response = await SessionAPI.createSession(sessionData);
      setCreatedSession(response);
      
      toast.success('Session created successfully!');
      
      // Reset the form
      reset();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create session';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCreateAnother = () => {
    setCreatedSession(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Recording Session</h1>
          <p className="text-gray-600">Start a new multi-track recording session</p>
        </div>

        {!createdSession ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Session Details
              </CardTitle>
              <CardDescription>
                Configure your recording session settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Session Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter session title"
                    {...register('title', { 
                      required: 'Session title is required',
                      minLength: { value: 3, message: 'Title must be at least 3 characters' }
                    })}
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-500">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter session description"
                    rows={3}
                    {...register('description')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxParticipants">Maximum Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min="2"
                    max="10"
                    {...register('maxParticipants', { 
                      required: 'Maximum participants is required',
                      min: { value: 2, message: 'Minimum 2 participants required' },
                      max: { value: 10, message: 'Maximum 10 participants allowed' }
                    })}
                    className={errors.maxParticipants ? 'border-red-500' : ''}
                  />
                  {errors.maxParticipants && (
                    <p className="text-sm text-red-500">{errors.maxParticipants.message}</p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Session...' : 'Create Session'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Clock className="h-5 w-5" />
                Session Created Successfully!
              </CardTitle>
              <CardDescription>
                Your recording session is ready. Share the link below with participants.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Session ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={createdSession.session_id}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdSession.session_id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Join URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={createdSession.join_url}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdSession.join_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Title</Label>
                    <p className="text-sm text-gray-900">{createdSession.title}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Max Participants</Label>
                    <p className="text-sm text-gray-900">{createdSession.max_participants}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Status</Label>
                    <p className="text-sm text-gray-900 capitalize">{createdSession.status}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Created</Label>
                    <p className="text-sm text-gray-900">
                      {new Date(createdSession.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => window.open(createdSession.join_url, '_blank')}
                  className="flex-1"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Join Session
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCreateAnother}
                  className="flex-1"
                >
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 