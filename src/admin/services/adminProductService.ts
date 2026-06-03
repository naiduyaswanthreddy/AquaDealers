import { supabase } from '@/lib/supabase';
import { Product } from '@/types/database';

export const adminProductService = {
  async getProducts(type?: string): Promise<Product[]> {
    let query = supabase
      .from('products')
      .select('*')
      .order('type')
      .order('company')
      .order('name');

    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Product[];
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async toggleProductActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },
};
