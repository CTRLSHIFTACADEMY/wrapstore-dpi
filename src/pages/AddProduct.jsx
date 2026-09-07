import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, X, Star, Image as ImageIcon, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PRODUCT_TYPES = [
  { value: 'iphone_case', label: 'iPhone Case', brands: ['Apple'], requiresModel: true },
  { value: 'samsung_case', label: 'Samsung Premium Case', brands: ['Samsung'], requiresModel: true },
  { value: 'mobile_sticker', label: 'Mobile Sticker', brands: [], requiresModel: false },
]

const IPHONE_MODELS = [
  'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
  'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
  'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13 Mini', 'iPhone 13',
  'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 Mini', 'iPhone 12',
  'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
  'iPhone SE (3rd Gen)', 'iPhone SE (2nd Gen)',
]

const SAMSUNG_MODELS = [
  'Samsung Galaxy S25 Ultra', 'Samsung Galaxy S25+', 'Samsung Galaxy S25',
  'Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24+', 'Samsung Galaxy S24',
  'Samsung Galaxy S23 Ultra', 'Samsung Galaxy S23+', 'Samsung Galaxy S23',
  'Samsung Galaxy S22 Ultra', 'Samsung Galaxy S22+', 'Samsung Galaxy S22',
  'Samsung Galaxy A55', 'Samsung Galaxy A35', 'Samsung Galaxy A15',
  'Samsung Galaxy Z Fold 6', 'Samsung Galaxy Z Flip 6',
]

const GST_OPTIONS = [0, 5, 12, 18, 28]

const AddProduct = ({ prefillData = null, productId = null, onSave = null }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef()

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState([])       // { file, preview, isPrimary }
  const [existingImages, setExistingImages] = useState([])  // for edit mode
  const [uploadingImages, setUploadingImages] = useState(false)

  const [form, setForm] = useState({
    name: '',
    product_type: '',
    category_id: '',
    subcategory_id: '',
    mobile_brand: '',
    mobile_model: '',
    description: '',
    purchase_price: '',
    selling_price: '',
    discount_percentage: '0',
    gst_percentage: '18',
    initial_stock: '',
    min_stock_level: '5',
    ...(prefillData || {}),
  })

  const [errors, setErrors] = useState({})

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  useEffect(() => {
    if (form.category_id) {
      supabase.from('subcategories').select('*').eq('category_id', form.category_id).order('sort_order')
        .then(({ data }) => setSubcategories(data || []))
    } else {
      setSubcategories([])
    }
  }, [form.category_id])

  const productTypeConfig = PRODUCT_TYPES.find(t => t.value === form.product_type)
  const modelOptions = form.product_type === 'iphone_case' ? IPHONE_MODELS : form.product_type === 'samsung_case' ? SAMSUNG_MODELS : []

  const set = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleTypeChange = (type) => {
    const config = PRODUCT_TYPES.find(t => t.value === type)
    setForm(prev => ({
      ...prev,
      product_type: type,
      mobile_brand: config?.brands[0] || '',
      mobile_model: '',
      category_id: '',
      subcategory_id: '',
    }))
  }

  // Image handling
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      isPrimary: images.length === 0 && i === 0,
      id: `new-${Date.now()}-${i}`,
    }))
    setImages(prev => {
      const updated = [...prev, ...newImages]
      if (!updated.some(img => img.isPrimary)) updated[0].isPrimary = true
      return updated
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) {
      const event = { target: { files } }
      handleFileSelect(event)
    }
  }

  const setPrimary = (id) => setImages(prev => prev.map(img => ({ ...img, isPrimary: img.id === id })))
  const removeImage = (id) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id)
      if (filtered.length > 0 && !filtered.some(img => img.isPrimary)) {
        filtered[0].isPrimary = true
      }
      return filtered
    })
  }

  // Upload images to Supabase Storage
  const uploadImages = async (productUuid) => {
    const results = []
    for (const img of images) {
      const ext = img.file.name.split('.').pop()
      const path = `products/${productUuid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(path, img.file, { cacheControl: '3600', upsert: false })

      if (uploadErr) {
        toast.error(`Failed to upload image: ${img.file.name}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)

      results.push({
        product_id: productUuid,
        storage_path: path,
        public_url: publicUrl,
        is_primary: img.isPrimary,
        sort_order: results.length,
        file_name: img.file.name,
        file_size: img.file.size,
      })
    }
    return results
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.product_type) e.product_type = 'Product type is required'
    if (!form.selling_price || Number(form.selling_price) <= 0) e.selling_price = 'Valid selling price required'
    if (!form.purchase_price || Number(form.purchase_price) < 0) e.purchase_price = 'Valid purchase price required'
    if (productTypeConfig?.requiresModel && !form.mobile_model) e.mobile_model = 'Mobile model is required for this product type'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) { toast.error('Please fix the errors above.'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        product_type: form.product_type,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        mobile_brand: form.mobile_brand || null,
        mobile_model: form.mobile_model || null,
        description: form.description || null,
        purchase_price: Number(form.purchase_price),
        selling_price: Number(form.selling_price),
        discount_percentage: Number(form.discount_percentage) || 0,
        gst_percentage: Number(form.gst_percentage) || 18,
        current_stock: productId ? undefined : Number(form.initial_stock) || 0,
        min_stock_level: Number(form.min_stock_level) || 5,
        created_by: user?.id,
        approval_status: 'PENDING_APPROVAL',
      }

      // Remove undefined keys
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      let productUuid = productId

      if (productId) {
        // Edit mode
        const { error } = await supabase.from('products').update(payload).eq('id', productId)
        if (error) throw error
      } else {
        // Create mode
        const { data, error } = await supabase.from('products').insert(payload).select().single()
        if (error) throw error
        productUuid = data.id

        // Record initial stock movement
        if (Number(form.initial_stock) > 0) {
          await supabase.from('inventory_movements').insert({
            product_id: productUuid,
            movement_type: 'INITIAL_STOCK',
            quantity: Number(form.initial_stock),
            previous_stock: 0,
            new_stock: Number(form.initial_stock),
            reason: 'Initial stock on product creation',
            performed_by: user?.id,
          })
        }
      }

      // Upload images
      if (images.length > 0) {
        setUploadingImages(true)
        const imageRecords = await uploadImages(productUuid)
        if (imageRecords.length > 0) {
          await supabase.from('product_images').insert(imageRecords)
        }
        setUploadingImages(false)
      }

      toast.success(productId ? 'Product updated! Awaiting approval.' : 'Product added! Awaiting approval.')

      if (onSave) onSave()
      else navigate('/products')
    } catch (err) {
      toast.error(err.message || 'Failed to save product')
      setUploadingImages(false)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = saving || uploadingImages

  return (
    <div>
      {/* Back */}
      <div style={{ marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => onSave ? onSave() : navigate('/products')}>
          <ArrowLeft size={14} /> Back to Products
        </button>
      </div>

      <form onSubmit={handleSubmit} id="add-product-form">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Basic Info */}
            <div className="card">
              <div className="card-header"><span className="card-title">Basic Information</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Product Name <span className="required">*</span></label>
                  <input
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="e.g. iPhone 16 Pro Max Transparent Case"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    id="product-name"
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Product Type <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {PRODUCT_TYPES.map(t => (
                      <label
                        key={t.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 14px',
                          border: `2px solid ${form.product_type === t.value ? 'var(--brand-black)' : 'var(--border-strong)'}`,
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 500,
                          transition: 'all var(--transition)',
                          background: form.product_type === t.value ? '#f3f4f6' : 'white',
                        }}
                      >
                        <input
                          type="radio"
                          name="product_type"
                          value={t.value}
                          checked={form.product_type === t.value}
                          onChange={() => handleTypeChange(t.value)}
                          style={{ display: 'none' }}
                        />
                        <div style={{
                          width: '14px', height: '14px', borderRadius: '50%',
                          border: `2px solid ${form.product_type === t.value ? 'var(--brand-black)' : 'var(--border-strong)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {form.product_type === t.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-black)' }} />}
                        </div>
                        {t.label}
                      </label>
                    ))}
                  </div>
                  {errors.product_type && <div className="form-error">{errors.product_type}</div>}
                </div>

                {/* Mobile Compatibility */}
                {form.product_type && form.product_type !== 'mobile_sticker' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Mobile Brand</label>
                      <input className="form-input" value={form.mobile_brand} readOnly style={{ background: '#f9fafb', color: 'var(--text-muted)' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Model <span className="required">*</span></label>
                      <select
                        className={`form-select ${errors.mobile_model ? 'error' : ''}`}
                        value={form.mobile_model}
                        onChange={e => set('mobile_model', e.target.value)}
                        id="mobile-model"
                      >
                        <option value="">Select model...</option>
                        {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {errors.mobile_model && <div className="form-error">{errors.mobile_model}</div>}
                    </div>
                  </div>
                )}

                {form.product_type === 'mobile_sticker' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Compatible Brand <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(optional)</span></label>
                      <input className="form-input" placeholder="Universal / Apple / Samsung..." value={form.mobile_brand} onChange={e => set('mobile_brand', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Compatible Model <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(optional)</span></label>
                      <input className="form-input" placeholder="Leave blank for universal stickers" value={form.mobile_model} onChange={e => set('mobile_model', e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the product, its features, materials, compatibility..."
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="card">
              <div className="card-header"><span className="card-title">Category</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={form.category_id}
                      onChange={e => { set('category_id', e.target.value); set('subcategory_id', '') }}
                    >
                      <option value="">Select category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Subcategory</label>
                    <select
                      className="form-select"
                      value={form.subcategory_id}
                      onChange={e => set('subcategory_id', e.target.value)}
                      disabled={!form.category_id || subcategories.length === 0}
                    >
                      <option value="">Select subcategory...</option>
                      {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="card">
              <div className="card-header"><span className="card-title">Pricing</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price (₹) <span className="required">*</span></label>
                    <input
                      type="number"
                      className={`form-input ${errors.purchase_price ? 'error' : ''}`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={form.purchase_price}
                      onChange={e => set('purchase_price', e.target.value)}
                      id="purchase-price"
                    />
                    {errors.purchase_price && <div className="form-error">{errors.purchase_price}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹) <span className="required">*</span></label>
                    <input
                      type="number"
                      className={`form-input ${errors.selling_price ? 'error' : ''}`}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={form.selling_price}
                      onChange={e => set('selling_price', e.target.value)}
                      id="selling-price"
                    />
                    {errors.selling_price && <div className="form-error">{errors.selling_price}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Discount (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      min="0"
                      max="100"
                      value={form.discount_percentage}
                      onChange={e => set('discount_percentage', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">GST (%)</label>
                    <select
                      className="form-select"
                      value={form.gst_percentage}
                      onChange={e => set('gst_percentage', e.target.value)}
                    >
                      {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </div>
                </div>

                {form.selling_price && (
                  <div style={{ marginTop: '14px', padding: '12px', background: '#f9fafb', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Selling Price:</span>
                      <span style={{ fontWeight: 600 }}>₹{Number(form.selling_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                    </div>
                    {Number(form.discount_percentage) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>After Discount ({form.discount_percentage}%):</span>
                        <span style={{ fontWeight: 600 }}>₹{(Number(form.selling_price) * (1 - Number(form.discount_percentage) / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {Number(form.gst_percentage) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Price + GST ({form.gst_percentage}%):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹{(Number(form.selling_price) * (1 + Number(form.gst_percentage) / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Product Images */}
            <div className="card">
              <div className="card-header"><span className="card-title">Product Images</span></div>
              <div className="card-body">
                {/* Dropzone */}
                <div
                  className="image-dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                >
                  <div className="image-dropzone-icon"><Upload size={22} /></div>
                  <div className="image-dropzone-text">Click or drag & drop images</div>
                  <div className="image-dropzone-hint">JPG, PNG, WebP — Multiple files supported</div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  id="product-images-input"
                />

                {/* Previews */}
                {images.length > 0 && (
                  <div className="image-preview-grid">
                    {images.map(img => (
                      <div key={img.id} className={`image-preview-item ${img.isPrimary ? 'primary' : ''}`}>
                        <img src={img.preview} alt="preview" />
                        {img.isPrimary && <div className="image-primary-badge">Primary</div>}
                        <div className="image-preview-actions">
                          {!img.isPrimary && (
                            <button
                              type="button"
                              className="image-action-btn"
                              onClick={() => setPrimary(img.id)}
                              title="Set as primary"
                            >
                              <Star size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="image-action-btn danger"
                            onClick={() => removeImage(img.id)}
                            title="Remove"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stock */}
            {!productId && (
              <div className="card">
                <div className="card-header"><span className="card-title">Initial Stock</span></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">Initial Stock Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0"
                      min="0"
                      value={form.initial_stock}
                      onChange={e => set('initial_stock', e.target.value)}
                      id="initial-stock"
                    />
                    <div className="form-hint">Stock will be recorded as initial inventory movement.</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Minimum Stock Level</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="5"
                      min="0"
                      value={form.min_stock_level}
                      onChange={e => set('min_stock_level', e.target.value)}
                    />
                    <div className="form-hint">Alert when stock falls below this level.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Info */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius)',
              padding: '14px',
              display: 'flex',
              gap: '10px',
              fontSize: '13px',
              color: '#1d4ed8'
            }}>
              <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Approval Required</strong>
                <div style={{ marginTop: 3, color: '#3b82f6' }}>
                  This product will be submitted for Super Admin approval before becoming active in inventory.
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={isLoading}
              id="submit-product-btn"
            >
              {isLoading ? (
                <><div className="btn-spinner" /> {uploadingImages ? 'Uploading images...' : 'Saving...'}</>
              ) : (
                <><Save size={16} /> {productId ? 'Update Product' : 'Submit for Approval'}</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddProduct
