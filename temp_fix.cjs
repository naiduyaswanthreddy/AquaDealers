const fs = require('fs');
const path = require('path');
const templatesDir = path.join('src', 'features', 'billing', 'components', 'templates');
const files = fs.readdirSync(templatesDir).filter(f => f.startsWith('Template') && f.endsWith('.tsx'));

for (const file of files) {
  if (file === 'TemplateOne.tsx') continue; // already done manually
  
  const filePath = path.join(templatesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add import if not exists
  if (!content.includes('SignatureRenderer')) {
    content = content.replace(
      /import \{ formatCurrency, formatDate \} from \'@\/lib\/utils\';/,
      `import { formatCurrency, formatDate } from '@/lib/utils';\nimport SignatureRenderer from '../SignatureRenderer';`
    );
  }

  // Update Template
  content = content.replace(/{ bill, dealer, settings, type = 'bill' }/, "{ bill, dealer, settings, type = 'bill', billSignature }");
  
  // Look for the Authorized Signatory area. It's different in each template.
  // We can just use a regex for "For {dealer?.shop_name || dealer?.name}" 
  // or "Authorized Signatory"
  
  if (file === 'TemplateTwo.tsx') {
    content = content.replace(
      /<p className="font-bold text-xs mb-12">For \{dealer\?\.shop_name \|\| dealer\?\.name\}<\/p>/,
      `<p className="font-bold text-xs mb-2">For {dealer?.shop_name || dealer?.name}</p>
          {billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mx-auto mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="h-16 mb-2"></div>
          )}`
    );
  } else if (file === 'TemplateThree.tsx') {
    // Has: <div className="border-b border-teal-800 w-48 mb-2"></div>
    content = content.replace(
      /<div className="border-b border-teal-800 w-48 mb-2"><\/div>/,
      `{billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="border-b border-teal-800 w-48 mb-2"></div>
          )}`
    );
  } else if (file === 'TemplateFour.tsx') {
    // Has: <div className="border-b border-gray-400 w-48 mb-2"></div>
    content = content.replace(
      /<div className="border-b border-gray-400 w-48 mb-2"><\/div>/,
      `{billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="border-b border-gray-400 w-48 mb-2"></div>
          )}`
    );
  } else if (file === 'TemplateFive.tsx') {
    // Has: <div className="border-b border-amber-800 w-48 mb-2"></div>
    content = content.replace(
      /<div className="border-b border-amber-800 w-48 mb-2"><\/div>/,
      `{billSignature?.signature_data?.length ? (
            <div className="h-16 w-32 mb-2">
              <SignatureRenderer strokes={billSignature.signature_data} className="h-full w-full" />
            </div>
          ) : (
            <div className="border-b border-amber-800 w-48 mb-2"></div>
          )}`
    );
  }

  fs.writeFileSync(filePath, content);
  console.log('Fixed', file);
}
