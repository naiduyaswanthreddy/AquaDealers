import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { PageShell } from './PageShell';
import { SectionCard } from './SectionCard';

interface AccessRestrictedPageProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionPath?: string;
}

export const AccessRestrictedPage: React.FC<AccessRestrictedPageProps> = ({
  title = 'Access restricted',
  description = 'This staff profile does not have permission to open this section.',
  actionLabel = 'Go back to More',
  actionPath = '/more',
}) => {
  const navigate = useNavigate();

  return (
    <PageShell width="narrow">
      <SectionCard className="flex min-h-[48dvh] flex-col items-center justify-center py-14 text-center">
        <div className="mb-5 flex h-18 w-18 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-text-primary">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
        <Button className="mt-8" onClick={() => navigate(actionPath)} leftIcon={<ArrowLeft className="h-4.5 w-4.5" />}>
          {actionLabel}
        </Button>
      </SectionCard>
    </PageShell>
  );
};

export default AccessRestrictedPage;

