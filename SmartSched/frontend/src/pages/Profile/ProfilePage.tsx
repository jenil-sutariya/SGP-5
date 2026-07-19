import { Card } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">My Profile</h2>
      {user ? (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <strong>Name:</strong> {user.firstName} {user.lastName}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Role:</strong> {user.role?.name}
          </p>
          {user.instituteId && (
            <p>
              <strong>Institute:</strong> {user.instituteId}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No user session found.</p>
      )}
    </Card>
  );
}
