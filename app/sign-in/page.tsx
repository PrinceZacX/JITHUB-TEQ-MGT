import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AuthScreen } from '@/components/auth-screen';

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect('/');
  const authAvailable = Boolean(
    process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32,
  );
  return <AuthScreen authAvailable={authAvailable} />;
}
