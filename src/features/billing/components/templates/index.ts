import { TemplateOne } from './TemplateOne';
import { TemplateTwo } from './TemplateTwo';
import { TemplateThree } from './TemplateThree';
import { TemplateFour } from './TemplateFour';
import { TemplateFive } from './TemplateFive';
import { StatementTemplate } from './StatementTemplate';

export const InvoiceTemplates: Record<string, React.FC<any>> = {
  template1: TemplateOne,
  template2: TemplateTwo,
  template3: TemplateThree,
  template4: TemplateFour,
  template5: TemplateFive,
};

export const StatementTemplates: Record<string, React.FC<any>> = {
  statement1: StatementTemplate,
};

export {
  TemplateOne,
  TemplateTwo,
  TemplateThree,
  TemplateFour,
  TemplateFive,
  StatementTemplate,
};
