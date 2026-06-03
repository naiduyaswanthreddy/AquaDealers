import React from 'react';

interface FarmerHeaderCardProps {
  name: string;
  imageUrl?: string | null;
  pond?: string;
  riskLevel?: 'Low Risk' | 'Medium Risk' | 'High Risk';
}

import { FarmerAvatar } from '@/components/ui';

export const FarmerHeaderCard: React.FC<FarmerHeaderCardProps> = ({ 
  name, 
  imageUrl,
  pond = 'Pond 3', 
  riskLevel = 'Low Risk' 
}) => {
  return (
    <div className="relative flex items-center justify-between overflow-hidden bg-[#10b981] px-4 py-5 text-white">
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-14 h-14 rounded-full border-2 border-white/20 shadow-sm backdrop-blur-sm overflow-hidden flex items-center justify-center bg-white/20">
          <FarmerAvatar 
            imageUrl={imageUrl} 
            name={name} 
            size="lg" 
            className="w-full h-full text-white" 
          />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{name}</h2>
          <p className="text-white/80 text-[0.85rem] font-medium">{pond}</p>
        </div>
      </div>
      
      {riskLevel && (
        <div className="relative z-10 self-end">
          <span className="px-3 py-1.5 rounded-full text-[0.65rem] font-black uppercase tracking-widest bg-white/10 border border-white/20 text-white backdrop-blur-sm shadow-sm">
            {riskLevel}
          </span>
        </div>
      )}
    </div>
  );
};

export default FarmerHeaderCard;
