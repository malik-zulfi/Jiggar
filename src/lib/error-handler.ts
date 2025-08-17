import { toast } from '@/hooks/use-toast';

export function handleError(error: unknown) {
  console.error(error);

  let message = 'An unexpected error occurred.';
  if (error instanceof Error) {
    message = error.message;
  }

  toast({
    title: 'Error',
    description: message,
    variant: 'destructive',
  });
}
