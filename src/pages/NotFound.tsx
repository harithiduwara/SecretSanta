import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, Card, EmptyState } from '../components/ui';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState
        icon={<Compass size={26} />}
        title="Page not found"
        body="The page you're looking for doesn't exist."
        action={<Button onClick={() => navigate('/')}>Go home</Button>}
      />
    </Card>
  );
}
