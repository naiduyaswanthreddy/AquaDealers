import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Droplet } from 'lucide-react';

const ShopHomePage: React.FC = () => {
  const { shopSlug } = useParams<{ shopSlug: string }>();

  // In a real app, you would fetch shop details based on shopSlug
  const shopName = shopSlug ? shopSlug.replace(/-/g, ' ').toUpperCase() : 'AQUA DEALER';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200">
      {/* Shop Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Droplet className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">{shopName}</span>
          </div>
          <a href="tel:+919999999999" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full font-semibold text-sm hover:bg-slate-200 transition-colors">
            <Phone className="w-4 h-4" />
            Call Now
          </a>
        </div>
      </header>

      {/* Shop Hero */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2rem] p-8 sm:p-12 shadow-xl shadow-slate-200/50 border border-slate-100 text-center mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">Pure Water, Delivered Fast.</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
            Welcome to {shopName}. We provide premium 20L water jars for homes and offices with reliable daily delivery.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-slate-500">
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-500" /> Serving local area</div>
            <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> 8 AM - 8 PM</div>
          </div>
        </motion.div>

        {/* Products */}
        <h2 className="text-2xl font-bold mb-6">Our Products</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((item) => (
            <motion.div 
              key={item}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: item * 0.1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="w-full aspect-square bg-slate-100 rounded-xl mb-4 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <Droplet className="w-16 h-16 text-blue-300 group-hover:text-blue-500 transition-colors" />
              </div>
              <h3 className="text-lg font-bold">20L RO Water Jar</h3>
              <p className="text-blue-600 font-bold text-xl mt-2">₹40</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 text-center">
        <p>Powered by <Link to="/" className="text-white font-bold hover:underline">AquaDealers</Link></p>
      </footer>
    </div>
  );
};

export default ShopHomePage;
