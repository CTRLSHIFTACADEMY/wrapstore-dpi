import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  ArrowUpDown, ChevronLeft, ChevronRight, MoreVertical,
  Smartphone, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PRODUCT_TYPES = {
  iphone_case: 'iPhone Case',
  samsung_case: 'Samsung Case',
  mobile_sticker: 'Mobile Sticker',
}

const APPROVAL_BADGE = {
  PENDING_APPROVAL: { class: 'badge-pending', label: 'Pending' },
  APPROVED: { class: 'badge-success', label: 'Approved' },
  REJECTED: { class: 'badge-danger', label: 'Rejected' },
}

const PAGE_SIZE = 15

const Products = () => {
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const navigate = useNavigate()
  const { isSuperAdmin } = useAuth()

  const fetchProducts = async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(`
        *,
        categories(name),
        subcategories(name),
        product_images(public_url, is_primary)
      `, { count: 'exact' })
      .eq('is_active', true)

    if (search) {
      query = query.or(`name.ilike.%${search}%,product_id.ilike.%${search}%,mobile_model.ilike.%${search}%,mobile_brand.ilike.%${search}%`)
    }
    if (typeFilter) query = query.eq('product_type', typeFilter)
    if (statusFilter) query = query.eq('approval_status', statusFilter)

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) toast.error('Failed to load products')
    else { setProducts(data || []); setTotal(count || 0) }
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [search, typeFilter, statusFilter, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Product removed.'); setDeleteId(null); fetchProducts() }
    setDeleting(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const formatCurrency = (v) => '₹' + Number(v).toLocaleString('en-IN')

  const getStockStatus = (p) => {
    if (p.current_stock === 0) return { label: 'OUT OF STOCK', class: 'badge-danger' }
    if (p.current_stock <= p.min_stock_level) return { label: 'LOW STOCK', class: 'badge-warning' }
    return { label: 'IN STOCK', class: 'badge-success' }
  }

  const getPrimaryImage = (images) =>
    images?.find(i => i.is_primary)?.public_url || images?.[0]?.public_url || null

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Products</div>
          <div className="section-subtitle">{total} products total</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/products/add')} id="add-product-btn">
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, ID, model, brand..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            id="product-search"
          />
        </div>

        <select
          className="filter-select"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          id="type-filter"
        >
          <option value="">All Types</option>
          <option value="iphone_case">iPhone Cases</option>
          <option value="samsung_case">Samsung Cases</option>
          <option value="mobile_sticker">Mobile Stickers</option>
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          id="status-filter"
        >
          <option value="">All Status</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={24} /></div>
            <h3>No products found</h3>
            <p>Try adjusting your search or add a new product.</p>
            <button className="btn btn-primary" onClick={() => navigate('/products/add')}>
              <Plus size={14} /> Add Product
            </button>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>Image</th>
                    <th onClick={() => handleSort('product_id')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        ID <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th onClick={() => handleSort('name')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Product <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th>Type</th>
                    <th>Brand / Model</th>
                    <th onClick={() => handleSort('selling_price')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Price <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th onClick={() => handleSort('current_stock')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        Stock <ArrowUpDown size={11} />
                      </span>
                    </th>
                    <th>Stock Status</th>
                    <th>Approval</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const imgUrl = getPrimaryImage(p.product_images)
                    const stockStatus = getStockStatus(p)
                    const approvalBadge = APPROVAL_BADGE[p.approval_status]
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="product-thumb">
                            {imgUrl
                              ? <img src={imgUrl} alt={p.name} />
                              : <div className="product-thumb-placeholder"><ImageIcon size={14} /></div>
                            }
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {p.product_id || '—'}
                          </code>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          {p.categories?.name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                              {p.categories.name}{p.subcategories?.name ? ` › ${p.subcategories.name}` : ''}
                            </div>
                          )}
                          {p.approval_status === 'REJECTED' && p.rejection_reason && (
                            <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 2, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ✕ {p.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="product-type-tag">
                            <Smartphone size={10} />
                            {PRODUCT_TYPES[p.product_type]}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {p.mobile_brand && <div style={{ fontWeight: 500 }}>{p.mobile_brand}</div>}
                          {p.mobile_model && <div style={{ color: 'var(--text-muted)' }}>{p.mobile_model}</div>}
                          {!p.mobile_brand && !p.mobile_model && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '13px' }}>{formatCurrency(p.selling_price)}</div>
                          {p.gst_percentage > 0 && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{p.gst_percentage}% GST</div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.current_stock}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>min {p.min_stock_level}</div>
                        </td>
                        <td>
                          <span className={`badge ${stockStatus.class}`}>{stockStatus.label}</span>
                        </td>
                        <td>
                          <span className={`badge ${approvalBadge.class}`}>{approvalBadge.label}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => navigate(`/products/edit/${p.id}`)}
                              title="Edit product"
                            >
                              <Edit2 size={13} />
                            </button>
                            {isSuperAdmin && (
                              <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => setDeleteId(p.id)}
                                title="Remove product"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} products
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + Math.max(1, page - 2)
                    if (p > totalPages) return null
                    return (
                      <button
                        key={p}
                        className={`pagination-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  })}
                  <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remove Product</span>
            </div>
            <div className="modal-body" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Are you sure you want to remove this product? It will be hidden from all views.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><div className="btn-spinner" /> Removing...</> : <><Trash2 size={13} /> Remove</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
