// pages/dashboard.tsx
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Dashboard() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<any[]>([]);

  useEffect(() => {
    if (session?.accessToken) {
      fetch('/api/user/repositories', {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      })
        .then((res) => res.json())
        .then((data) => setRepositories(data.repositories))
        .catch((err) => console.error('Error fetching repositories:', err));
    }
  }, [session]);

  if (!session) {
    return <p>Please log in to view your dashboard.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Welcome, {session.user?.name}</p>
      <div className="mt-6">
        <h2 className="text-xl mb-2">Your Repositories</h2>
        {repositories.length > 0 ? (
          <ul className="list-disc pl-5">
            {repositories.map((repo) => (
              <li key={repo.id}>
                <Link href={`/repository/${repo.name}`}>
                  <a className="text-blue-600">{repo.name}</a>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No repositories found or you haven't added any yet.</p>
        )}
      </div>
    </div>
  );
}
