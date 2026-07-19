import { Card } from '@/components/ui';

export default function SettingsPage() {
  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">CHARUSAT Settings</h2>
      <p className="mt-2 text-sm text-muted">
        This portal is configured exclusively for Charotar University of Science and Technology (Changa).
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          <strong>University:</strong> CHARUSAT
        </p>
        <p>
          <strong>Campus:</strong> Changa, Anand, Gujarat — 388421
        </p>
        <p>
          <strong>Allowed emails:</strong> @charusat.edu.in, @charusat.ac.in
        </p>
        <p>
          <strong>API Docs:</strong>{' '}
          <a
            href="http://localhost:5000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            http://localhost:5000/api/docs
          </a>
        </p>
      </div>
    </Card>
  );
}
