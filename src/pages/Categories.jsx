import React, { useEffect, useState } from 'react'
import {
  Plus, ChevronDown, ChevronRight, Edit2, Trash2,
  Tag, X, Check, FolderOpen, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---- Modal Component ----
const FieldModal = ({ title, placeholder, initialValue = '', onSave, onClose, loading }) => {
  const [value, setValue] = useState(initialValue)
  const [desc, setDesc] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!value.trim()) return
    onSave(value.trim(), desc.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name <span className="required">*</span></label>
              <input
                className="form-input"
                placeholder={placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Optional description..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !value.trim()}>
              {loading ? <><div className="btn-spinner" /> Saving...</> : <><Check size={14} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DeleteConfirm = ({ name, onConfirm, onClose, loading }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-title">Delete Confirmation</span>
        <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="modal-body">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Delete "{name}"?</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              This action cannot be undone. Products in this category may be affected.
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <><div className="btn-spinner" /> Deleting...</> : <><Trash2 size={13} /> Delete</>}
        </button>
      </div>
    </div>
  </div>
)

const Categories = () => {
  const [categories, setCategories] = useState([])
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modals
  const [addCatModal, setAddCatModal] = useState(false)
  const [editCatModal, setEditCatModal] = useState(null)   // category object
  const [deleteCatModal, setDeleteCatModal] = useState(null)
  const [addSubModal, setAddSubModal] = useState(null)     // parent category id
  const [editSubModal, setEditSubModal] = useState(null)   // subcategory object
  const [deleteSubModal, setDeleteSubModal] = useState(null)

  const fetchCategories = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select(`*, subcategories(*)`)
      .order('sort_order', { ascending: true })
    setCategories(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  // ---- Category CRUD ----
  const handleAddCategory = async (name, description) => {
    setSaving(true)
    const { error } = await supabase.from('categories').insert({
      name,
      slug: slugify(name),
      description: description || null,
      sort_order: categories.length,
    })
    if (error) {
      toast.error(error.message.includes('unique') ? 'Category already exists.' : error.message)
    } else {
      toast.success('Category added!')
      setAddCatModal(false)
      fetchCategories()
    }
    setSaving(false)
  }

  const handleEditCategory = async (name, description) => {
    setSaving(true)
    const { error } = await supabase.from('categories').update({
      name,
      slug: slugify(name),
      description: description || null,
    }).eq('id', editCatModal.id)
    if (error) toast.error(error.message)
    else { toast.success('Category updated!'); setEditCatModal(null); fetchCategories() }
    setSaving(false)
  }

  const handleDeleteCategory = async () => {
    setSaving(true)
    const { error } = await supabase.from('categories').delete().eq('id', deleteCatModal.id)
    if (error) toast.error(error.message)
    else { toast.success('Category deleted!'); setDeleteCatModal(null); fetchCategories() }
    setSaving(false)
  }

  // ---- Subcategory CRUD ----
  const handleAddSub = async (name, description) => {
    setSaving(true)
    const { error } = await supabase.from('subcategories').insert({
      category_id: addSubModal,
      name,
      slug: slugify(name),
      description: description || null,
    })
    if (error) toast.error(error.message.includes('unique') ? 'Subcategory already exists in this category.' : error.message)
    else { toast.success('Subcategory added!'); setAddSubModal(null); fetchCategories() }
    setSaving(false)
  }

  const handleEditSub = async (name, description) => {
    setSaving(true)
    const { error } = await supabase.from('subcategories').update({
      name,
      slug: slugify(name),
      description: description || null,
    }).eq('id', editSubModal.id)
    if (error) toast.error(error.message)
    else { toast.success('Subcategory updated!'); setEditSubModal(null); fetchCategories() }
    setSaving(false)
  }

  const handleDeleteSub = async () => {
    setSaving(true)
    const { error } = await supabase.from('subcategories').delete().eq('id', deleteSubModal.id)
    if (error) toast.error(error.message)
    else { toast.success('Subcategory deleted!'); setDeleteSubModal(null); fetchCategories() }
    setSaving(false)
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Product Categories</div>
          <div className="section-subtitle">{categories.length} categories configured</div>
        </div>
        <button className="btn btn-primary" onClick={() => setAddCatModal(true)} id="add-category-btn">
          <Plus size={14} /> Add Category
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /></div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Tag size={24} /></div>
          <h3>No categories yet</h3>
          <p>Create your first product category to get started.</p>
          <button className="btn btn-primary" onClick={() => setAddCatModal(true)}>
            <Plus size={14} /> Add Category
          </button>
        </div>
      ) : (
        <div>
          {categories.map(cat => {
            const isOpen = expanded[cat.id]
            const subs = cat.subcategories || []
            return (
              <div key={cat.id} className="category-item">
                <div className="category-header">
                  <button
                    className="category-expand-btn"
                    onClick={() => toggleExpand(cat.id)}
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOpen size={15} color="var(--text-secondary)" />
                    </div>
                    <div>
                      <div className="category-name">{cat.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {subs.length} subcategor{subs.length === 1 ? 'y' : 'ies'}
                        {cat.description ? ` · ${cat.description}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="category-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setAddSubModal(cat.id); setExpanded(p => ({...p, [cat.id]: true})) }}
                      title="Add subcategory"
                    >
                      <Plus size={13} /> Sub
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setEditCatModal(cat)}
                      title="Edit category"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setDeleteCatModal(cat)}
                      title="Delete category"
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="subcategory-list">
                    {subs.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No subcategories yet.{' '}
                        <span
                          style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => setAddSubModal(cat.id)}
                        >
                          Add one
                        </span>
                      </div>
                    ) : (
                      subs
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(sub => (
                          <div key={sub.id} className="subcategory-item">
                            <div className="subcategory-dot" />
                            <div className="subcategory-name">{sub.name}</div>
                            {sub.description && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: 8 }}>{sub.description}</div>
                            )}
                            <div className="subcategory-actions">
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setEditSubModal(sub)}
                                title="Edit"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setDeleteSubModal(sub)}
                                title="Delete"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {addCatModal && (
        <FieldModal title="Add Category" placeholder="e.g. Mobile Cases" onSave={handleAddCategory} onClose={() => setAddCatModal(false)} loading={saving} />
      )}
      {editCatModal && (
        <FieldModal title="Edit Category" placeholder={editCatModal.name} initialValue={editCatModal.name} onSave={handleEditCategory} onClose={() => setEditCatModal(null)} loading={saving} />
      )}
      {deleteCatModal && (
        <DeleteConfirm name={deleteCatModal.name} onConfirm={handleDeleteCategory} onClose={() => setDeleteCatModal(null)} loading={saving} />
      )}
      {addSubModal && (
        <FieldModal
          title={`Add Subcategory to "${categories.find(c => c.id === addSubModal)?.name}"`}
          placeholder="e.g. iPhone Cases"
          onSave={handleAddSub}
          onClose={() => setAddSubModal(null)}
          loading={saving}
        />
      )}
      {editSubModal && (
        <FieldModal title="Edit Subcategory" placeholder={editSubModal.name} initialValue={editSubModal.name} onSave={handleEditSub} onClose={() => setEditSubModal(null)} loading={saving} />
      )}
      {deleteSubModal && (
        <DeleteConfirm name={deleteSubModal.name} onConfirm={handleDeleteSub} onClose={() => setDeleteSubModal(null)} loading={saving} />
      )}
    </div>
  )
}

export default Categories
