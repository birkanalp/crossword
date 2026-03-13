'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminListCoinPackages,
  adminCreateCoinPackage,
  adminUpdateCoinPackage,
  adminDeleteCoinPackage,
  adminToggleCoinPackage,
  type CoinPackageAdmin,
  type CoinPackageInput,
} from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';

const BADGE_OPTIONS = [
  { value: '', label: 'Yok' },
  { value: 'popular', label: 'Popüler' },
  { value: 'best_value', label: 'En İyi Değer' },
  { value: 'new', label: 'Yeni' },
  { value: 'limited', label: 'Sınırlı' },
];

const BADGE_STYLES: Record<string, string> = {
  popular: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  best_value: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  new: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  limited: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
};

const BADGE_LABELS: Record<string, string> = {
  popular: 'Popüler',
  best_value: 'En İyi Değer',
  new: 'Yeni',
  limited: 'Sınırlı',
};

const DEFAULT_FORM: CoinPackageInput = {
  name: '',
  description: '',
  coin_amount: 10,
  price_usd: 0.99,
  original_price_usd: null,
  discount_percent: 0,
  badge: null,
  is_featured: false,
  is_active: true,
  sort_order: 0,
  revenuecat_product_id: '',
};

export default function ShopPage() {
  const { token } = useAuth();
  const [packages, setPackages] = useState<CoinPackageAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CoinPackageAdmin | null>(null);
  const [form, setForm] = useState<CoinPackageInput>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPackages = async () => {
    if (!token) return;
    setLoading(true);
    const { data, error: err } = await adminListCoinPackages(token);
    if (err) setError(err);
    else if (data) setPackages(data.packages);
    setLoading(false);
  };

  useEffect(() => { loadPackages(); }, [token]);

  const openCreate = () => {
    setEditingPackage(null);
    setForm(DEFAULT_FORM);
    setModalOpen(true);
  };

  const openEdit = (pkg: CoinPackageAdmin) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description ?? '',
      coin_amount: pkg.coin_amount,
      price_usd: pkg.price_usd,
      original_price_usd: pkg.original_price_usd,
      discount_percent: pkg.discount_percent,
      badge: pkg.badge,
      is_featured: pkg.is_featured,
      is_active: pkg.is_active,
      sort_order: pkg.sort_order,
      revenuecat_product_id: pkg.revenuecat_product_id ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    const payload: CoinPackageInput = {
      ...form,
      description: form.description || null,
      original_price_usd: form.discount_percent > 0 ? form.original_price_usd : null,
      badge: form.badge || null,
      revenuecat_product_id: form.revenuecat_product_id || null,
    };
    let err: string | null = null;
    if (editingPackage) {
      const res = await adminUpdateCoinPackage(token, editingPackage.id, payload);
      err = res.error;
    } else {
      const res = await adminCreateCoinPackage(token, payload);
      err = res.error;
    }
    setSaving(false);
    if (err) { alert('Hata: ' + err); return; }
    setModalOpen(false);
    loadPackages();
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(true);
    const { error: err } = await adminDeleteCoinPackage(token, id);
    setDeleting(false);
    setDeleteConfirm(null);
    if (err) { alert('Hata: ' + err); return; }
    loadPackages();
  };

  const handleToggle = async (pkg: CoinPackageAdmin) => {
    if (!token) return;
    const { error: err } = await adminToggleCoinPackage(token, pkg.id);
    if (err) { alert('Hata: ' + err); return; }
    // Optimistic update — flip is_active locally without refetch
    setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="w-8 h-8" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Magaza</h1>
          <p className="text-sm text-text-secondary mt-1">Coin paketlerini yonet</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          <span>+</span> Yeni Paket
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error-bg border border-error-border text-error text-sm">{error}</div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-tertiary">Toplam Paket</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{packages.length}</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-tertiary">Aktif Paket</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{packages.filter(p => p.is_active).length}</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-text-tertiary">Indirimli Paket</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{packages.filter(p => p.discount_percent > 0).length}</p>
        </div>
      </div>

      {/* Package grid */}
      {packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-secondary">Henuz paket yok. Ilk paketinizi ekleyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => openEdit(pkg)}
              onDelete={() => setDeleteConfirm(pkg.id)}
              onToggle={() => handleToggle(pkg)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-surface border border-border rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-text-primary">
                {editingPackage ? 'Paketi Duzenle' : 'Yeni Paket'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-text-tertiary hover:text-text-primary text-xl">x</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Paket Adi *</label>
                <input
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                  placeholder="Orn: Mega Paket"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Aciklama</label>
                <input
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                  placeholder="Kisa aciklama"
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              {/* Coin amount + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Coin Miktari *</label>
                  <input
                    type="number" min={1}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    value={form.coin_amount}
                    onChange={e => setForm(f => ({ ...f, coin_amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Fiyat (USD) *</label>
                  <input
                    type="number" min={0} step={0.01}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    value={form.price_usd}
                    onChange={e => setForm(f => ({ ...f, price_usd: Number(e.target.value) }))}
                  />
                </div>
              </div>
              {/* Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Indirim (%)</label>
                  <input
                    type="number" min={0} max={100}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    value={form.discount_percent}
                    onChange={e => setForm(f => ({ ...f, discount_percent: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Orijinal Fiyat (USD)</label>
                  <input
                    type="number" min={0} step={0.01}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    placeholder="Indirim varsa"
                    value={form.original_price_usd ?? ''}
                    onChange={e => setForm(f => ({ ...f, original_price_usd: e.target.value ? Number(e.target.value) : null }))}
                  />
                </div>
              </div>
              {/* Badge + Sort order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Rozet</label>
                  <select
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    value={form.badge ?? ''}
                    onChange={e => setForm(f => ({ ...f, badge: e.target.value as CoinPackageInput['badge'] || null }))}
                  >
                    {BADGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">Siralama</label>
                  <input
                    type="number" min={0}
                    className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  />
                </div>
              </div>
              {/* RevenueCat product ID */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">RevenueCat Product ID</label>
                <input
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent font-mono"
                  placeholder="coins_10"
                  value={form.revenuecat_product_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, revenuecat_product_id: e.target.value }))}
                />
              </div>
              {/* Toggles */}
              <div className="flex gap-6">
                {/* is_featured toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, is_featured: !f.is_featured }))}
                    className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${form.is_featured ? 'bg-yellow-500' : 'bg-bg-elevated border border-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow mt-1 transition-transform ${form.is_featured ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-text-secondary">One Cikan</span>
                </label>
                {/* is_active toggle */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-accent' : 'bg-bg-elevated border border-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow mt-1 transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-text-secondary">Aktif</span>
                </label>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">Iptal</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.coin_amount}
                className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-bold text-text-primary mb-2">Paketi Sil</h3>
            <p className="text-sm text-text-secondary mb-5">Bu islem geri alinamaz. Emin misiniz?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Iptal</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, onEdit, onDelete, onToggle }: {
  pkg: CoinPackageAdmin;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`relative bg-bg-surface border rounded-2xl p-5 transition-all ${
      pkg.is_featured ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/5' : 'border-border'
    } ${!pkg.is_active ? 'opacity-50' : ''}`}>
      {/* Featured ribbon — only shown when is_featured */}
      {pkg.is_featured && (
        <div className="absolute -top-2 left-4 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          ONE CIKAN
        </div>
      )}

      {/* Coin amount + badge row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-xl font-bold text-yellow-400">
            C
          </div>
          <div>
            <p className="text-lg font-bold text-text-primary">{pkg.coin_amount} Coin</p>
            <p className="text-xs text-text-tertiary">{pkg.name}</p>
          </div>
        </div>
        {pkg.badge && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${BADGE_STYLES[pkg.badge]}`}>
            {BADGE_LABELS[pkg.badge]}
          </span>
        )}
      </div>

      {/* Description */}
      {pkg.description && (
        <p className="text-xs text-text-tertiary mb-3">{pkg.description}</p>
      )}

      {/* Price row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl font-bold text-text-primary">${pkg.price_usd.toFixed(2)}</span>
        {pkg.discount_percent > 0 && pkg.original_price_usd && (
          <>
            <span className="text-sm text-text-tertiary line-through">${pkg.original_price_usd.toFixed(2)}</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              %{pkg.discount_percent} INDIRIM
            </span>
          </>
        )}
      </div>

      {/* RevenueCat product ID */}
      {pkg.revenuecat_product_id && (
        <p className="text-[10px] text-text-tertiary font-mono mb-4">ID: {pkg.revenuecat_product_id}</p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        {/* Active/Passive toggle button */}
        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
            pkg.is_active
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-bg-elevated text-text-tertiary hover:bg-bg-elevated/80'
          }`}
        >
          <span>{pkg.is_active ? '●' : '○'}</span>
          {pkg.is_active ? 'Aktif' : 'Pasif'}
        </button>
        <div className="flex-1" />
        <button
          onClick={onEdit}
          className="text-xs text-text-secondary hover:text-accent px-2.5 py-1.5 rounded-lg hover:bg-accent/10 transition-colors"
        >
          Duzenle
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-text-secondary hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          Sil
        </button>
      </div>
    </div>
  );
}
