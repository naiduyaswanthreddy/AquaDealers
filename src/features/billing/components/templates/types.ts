import type { TemplateSettings } from '@/stores/branchStore';
import type { Dealer } from '@/types/database';

export interface BillTemplateProps {
  bill: any; // We use any or the specific Bill type you have
  dealer: Dealer | null;
  settings: TemplateSettings;
  type?: 'bill' | 'statement';
  billSignature?: any;
}
