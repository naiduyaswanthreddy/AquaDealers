import React from 'react';
import { User } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export interface FarmerAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const AVATAR_COLORS = [
  { bg: '#FCE4EC', text: '#C2185B' }, // Pink
  { bg: '#E0F2F1', text: '#00796B' }, // Teal
  { bg: '#E8F5E9', text: '#388E3C' }, // Green
  { bg: '#E3F2FD', text: '#1976D2' }, // Blue
  { bg: '#F3E5F5', text: '#7B1FA2' }, // Purple
  { bg: '#FFF3E0', text: '#E65100' }, // Orange
];

export const FarmerAvatar: React.FC<FarmerAvatarProps> = ({ 
  imageUrl, 
  name, 
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl'
  };

  const baseClasses = "flex flex-shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 font-bold overflow-hidden";
  const finalClassName = `${baseClasses} ${sizeClasses[size]} ${className}`;

  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt={name || 'Farmer'} 
        loading="lazy" 
        className={`${finalClassName} object-cover`} 
      />
    );
  }

  if (name) {
    const avatarColor = AVATAR_COLORS[name.length % AVATAR_COLORS.length];
    return (
      <div
        className={finalClassName}
        style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div className={`${finalClassName} bg-slate-100 text-slate-500`}>
      <User className="w-1/2 h-1/2" />
    </div>
  );
};
