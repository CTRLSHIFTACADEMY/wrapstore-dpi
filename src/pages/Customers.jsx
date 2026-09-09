import React, { useEffect, useState } from 'react'
import {
  Search, Users, ChevronLeft, ChevronRight, ArrowUpDown,
  Eye, X, FileText, RefreshCw, Printer, Download
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { downloadInvoicePDF, printInvoicePDF } from '../lib/invoicePdf'

const INR = (v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PAGE_SIZE = 15

// ---- Customer Detail Modal ----
const CustomerModal = ({ customer, onClose }) => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState(null)
  const [actioning, setActioning] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: invData }, { data: storeData }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false }),
        supabase.from('store_settings').select('*').limit(1).single(),
      ])
      setInvoices(invData || [])
      setStore(storeData)
      setLoading(false)
    }
    load()
  }, [customer.id])

  const handlePDF = async (invoice, type) => {
    setActioning(invoice.id + '-' + type)
    try {
      const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id)
      const params = { invoice, items: items || [], store, logoUrl: store?.logo_url || null }
      if (type === 'print') await printInvoicePDF(params)
      else { await downloadInvoicePDF(params); toast.success('PDF downloaded!') }
    } catch (e) {
      toast.error('PDF failed: ' + e.message)
    }
    setActioning(null)
  }

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 640, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="modal-title">{customer.name}</span>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {customer.phone} · Customer since {formatDate(customer.created_at)}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Stats computed from actual invoices */}
          {(() => {
            const actualCount = invoices.length
            const actualSpent = invoices.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0)
            const actualLast = invoices[0]?.created_at || null
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  ['Total Orders', actualCount],
                  ['Total Spent', INR(actualSpent)],
                  ['Last Purchase', actualLast ? formatDate(actualLast) : '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#f9fafb', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Purchase History */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            Purchase History
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="spinner" /></div>
          ) : invoices.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p style={{ margin: 0, fontSize: 13 }}>No purchases recorded for this customer.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th style={{ width: 80 }}>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                          {inv.invoice_number}
                        </code>
                      </td>
                      <td style={{ fontSize: 13 }}>{formatDate(inv.created_at)}</td>
                      <td style={{ fontWeight: 700 }}>{INR(inv.grand_total)}</td>
                      <td>
                        <span className={`badge ${inv.payment_method === 'Cash' ? 'badge-success' : inv.payment_method === 'UPI' ? 'badge-info' : 'badge-primary'}`}>
                          {inv.payment_method}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handlePDF(inv, 'print')}
                            disabled={actioning === inv.id + '-print'}
                            title="Print PDF"
                          >
                            {actioning === inv.id + '-print' ? <div className="spinner-sm" /> : <Printer size={12} />}
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => handlePDF(inv, 'download')}
                            disabled={actioning === inv.id + '-download'}
                            title="Download PDF"
                          >
                            {actioning === inv.id + '-download' ? <div className="spinner-sm" /> : <Download size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Customers Page ----
const Customers = () => {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('total_spent')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const fetchCustomers = async () => {
    setLoading(true)
    let query = supabase
      .from('customers')
      .select('*, invoices(id, grand_total, created_at, customer_phone)', { count: 'exact' })

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    const { data, count } = await query
    const rawList = data || []

    // Reconcile and calculate exact metrics from customer's actual invoices
    const reconciled = rawList.map(c => {
      const invs = c.invoices || []
      const trueOrders = invs.length
      const trueSpent = invs.reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0)
      const sortedInvs = [...invs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      const trueLast = sortedInvs[0]?.created_at || c.last_purchase_at

      // Self-heal DB record if stored stats differ from actual invoices sum
      if (c.total_orders !== trueOrders || Number(c.total_spent) !== trueSpent) {
        supabase.from('customers').update({
          total_orders: trueOrders,
          total_spent: trueSpent,
          last_purchase_at: trueLast,
        }).eq('id', c.id).then(() => {})
      }

      return {
        ...c,
        total_orders: trueOrders,
        total_spent: trueSpent,
        last_purchase_at: trueLast,
      }
    })

    setCustomers(reconciled)
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [search, sortField, sortDir, page])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const formatDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Customers</div>
          <div className="section-subtitle">{total} customers total</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchCustomers}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: total, icon: Users },
          {
            label: 'Total Revenue',
            value: INR(customers.reduce((s, c) => s + Number(c.total_spent || 0), 0)),
            icon: FileText,
          },
          {
            label: 'Avg. Spend / Customer',
            value: total > 0
              ? INR(customers.reduce((s, c) => s + Number(c.total_spent || 0), 0) / customers.length)
              : '₹0.00',
            icon: Users,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name or phone number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            id="customer-search"
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={24} /></div>
            <h3>No customers yet</h3>
            <p>Customers are automatically created when you complete a sale.</p>
          </div>
        ) : (
          <>
            <div className="table-container" style={{ border: 'none', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Customer <ArrowUpDown size={11} /></span>
                    </th>
                    <th>Phone</th>
                    <th onClick={() => handleSort('total_orders')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Orders <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('total_spent')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Total Spent <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('last_purchase_at')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Last Purchase <ArrowUpDown size={11} /></span>
                    </th>
                    <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Customer Since <ArrowUpDown size={11} /></span>
                    </th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {c.phone}
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 800, fontSize: 16, color: c.total_orders >= 5 ? 'var(--success)' : 'var(--text-primary)',
                        }}>
                          {c.total_orders}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 14 }}>{INR(c.total_spent)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(c.last_purchase_at)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(c.created_at)}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => setSelectedCustomer(c)}
                          title="View customer details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </div>
                <div className="pagination-buttons">
                  <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}><ChevronLeft size={14} /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = i + Math.max(1, page - 2)
                    if (pg > totalPages) return null
                    return <button key={pg} className={`pagination-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
                  })}
                  <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  )
}

export default Customers
