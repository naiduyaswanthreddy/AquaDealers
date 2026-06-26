const fs = require('fs');
const file = 'd:/AquaDealer/src/features/landing/pages/LandingPage.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Add animations to the main grid wrappers
content = content.replaceAll(
  '<div className="grid md:grid-cols-2 gap-12 items-center">',
  '<motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.7 }} className="grid md:grid-cols-2 gap-12 items-center group">'
);
content = content.replaceAll(
  '           {/* Feature',
  '           </motion.div>\n           {/* Feature'
);
// Fix the closing tags. Because I replaced the opening <div> with <motion.div>, I need to replace the closing </div> for those grids.
// Actually, using a simple string replacement for closing tags is hard. It's safer to just rewrite the file content between lines 270 and 520, or write a smarter regex.
